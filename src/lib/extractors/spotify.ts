import { ExtractedTrack, ExtractorResult, PlaylistExtractor } from '@/types/playlist';

const TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token';
const API_BASE_URL = 'https://api.spotify.com/v1';
const EMBED_PAGE_BASE = 'https://open.spotify.com/embed/playlist';
const PUBLIC_PAGE_BASE = 'https://open.spotify.com/playlist';

const MAX_API_PAGES = 30; // Hasta ~3000 canciones de seguridad (páginas de 100)

const SPOTIFY_PAGE_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

// URI de Spotify: spotify:playlist:{id} y el formato legado spotify:user:{user}:playlist:{id}.
// Se tolera un sufijo de tracking pegado a la URI (?si=..., #...).
const PLAYLIST_URI_PATTERN =
  /^(?:spotify:user:[^:/?#]+:playlist:|spotify:playlist:)([A-Za-z0-9]{22})(?:[?#].*)?$/i;

// Rutas web: /playlist/{id}, /intl-es/playlist/{id}, /intl-pt-BR/playlist/{id},
// /embed/playlist/{id}, /user/{user}/playlist/{id}
const PLAYLIST_PATH_PATTERN =
  /^\/(?:intl-[a-z]{2}(?:-[a-z]{2}|\d{3})?\/)?(?:embed\/|user\/[^/]+\/)?playlist\/([A-Za-z0-9]{22})(?:\/|$)/i;

/**
 * Convierte milisegundos a texto legible: "3:44" o "1:02:05".
 */
function formatDurationText(durationMs?: number): string | undefined {
  if (typeof durationMs !== 'number' || !Number.isFinite(durationMs) || durationMs <= 0) {
    return undefined;
  }

  const totalSeconds = Math.round(durationMs / 1000);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  const ss = String(seconds).padStart(2, '0');

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${ss}`;
  }
  return `${minutes}:${ss}`;
}

/**
 * Separa artistas unidos por comas. El embed de Spotify entrega un `subtitle`
 * del estilo "Olivia Rodrigo, Chappell Roan".
 */
function splitArtistNames(raw?: string | null): string[] {
  if (typeof raw !== 'string') return [];
  return raw
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
}

/**
 * Extractor de playlists públicas de Spotify.
 *
 * Estrategia híbrida:
 * 1. Si existen SPOTIFY_CLIENT_ID y SPOTIFY_CLIENT_SECRET se usa la Web API
 *    oficial (Client Credentials) con paginación completa de canciones.
 * 2. Si no hay credenciales (o fallan) se intenta un token de sesión anónimo
 *    publicado por el embed público y, como último recurso, se hace scraping
 *    del estado embebido (__NEXT_DATA__ / initialState) del embed o de la
 *    página pública de la playlist.
 */
export class SpotifyExtractor implements PlaylistExtractor {
  readonly platform = 'spotify' as const;

  canHandle(url: string): boolean {
    return this.extractPlaylistId(url) !== null;
  }

  extractPlaylistId(url: string): string | null {
    const trimmed = url.trim();
    if (!trimmed) return null;

    // URI directa (spotify:playlist:{id} / spotify:user:{user}:playlist:{id})
    const uriMatch = trimmed.match(PLAYLIST_URI_PATTERN);
    if (uriMatch) return uriMatch[1];

    // URL con esquema o pegada sin esquema ("open.spotify.com/playlist/{id}?si=...")
    const candidates: URL[] = [];
    try {
      candidates.push(new URL(trimmed));
    } catch {
      if (/^[\w.-]+\.[a-z]{2,}(?:[/?#]|$)/i.test(trimmed)) {
        try {
          candidates.push(new URL(`https://${trimmed}`));
        } catch {
          // no es una URL interpretable
        }
      }
    }

    for (const parsed of candidates) {
      const host = parsed.hostname.toLowerCase();
      if (host !== 'open.spotify.com' && host !== 'www.open.spotify.com') continue;

      // El patrón solo mira el pathname: los query params de tracking (?si=..., etc.)
      // y los fragmentos nunca ensayan la extracción del id.
      const pathMatch = parsed.pathname.match(PLAYLIST_PATH_PATTERN);
      if (pathMatch) return pathMatch[1];
    }

    return null;
  }

  async extract(url: string): Promise<ExtractorResult> {
    const playlistId = this.extractPlaylistId(url);
    if (!playlistId) {
      throw new Error(
        'URL de Spotify inválida. Acepta enlaces como https://open.spotify.com/playlist/{id} o URIs como spotify:playlist:{id}.'
      );
    }

    // 1) Ruta oficial: Client Credentials si hay credenciales configuradas
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    let apiError: Error | null = null;

    if (clientId && clientSecret) {
      try {
        const token = await this.fetchClientCredentialsToken(clientId, clientSecret);
        const result = await this.fetchPlaylistViaApi(playlistId, token);
        if (result.tracks.length > 0) return result;
        // Respuesta válida pero sin canciones: se recuerda para enriquecer el
        // error final si el fallback anónimo tampoco encuentra nada.
        apiError = new Error(this.describeEmptyPlaylist(playlistId));
      } catch (err: any) {
        apiError = err instanceof Error ? err : new Error(String(err));
        console.warn(
          '[SpotifyExtractor] La API con credenciales falló, se usa el fallback anónimo:',
          apiError.message
        );
      }
    }

    // 2) Fallback anónimo: embed público + página pública
    try {
      return await this.extractAnonymously(playlistId);
    } catch (fallbackErr: any) {
      const fallbackError =
        fallbackErr instanceof Error ? fallbackErr : new Error(String(fallbackErr));
      const apiDetail = apiError?.message;

      // Sin credenciales, el error de red se propaga tal cual para que la capa
      // HTTP lo clasifique como fallo de conexión.
      if (!apiDetail && this.isNetworkError(fallbackError)) throw fallbackError;

      // Combina el detalle del fallback con el de la Web API sin duplicar texto.
      if (apiDetail && !fallbackError.message.includes(apiDetail)) {
        throw new Error(`${fallbackError.message} Detalles de la Web API: ${apiDetail}`);
      }
      throw fallbackError;
    }
  }

  /** Errores de conectividad/timeout que deben propagarse sin enmascarar. */
  private isNetworkError(err: Error): boolean {
    const code = (err as { code?: string }).code;
    if (
      err.name === 'AbortError' ||
      err.name === 'TimeoutError' ||
      (typeof code === 'string' &&
        ['ENOTFOUND', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN'].includes(code))
    ) {
      return true;
    }
    return /fetch failed|network|socket hang up|timed? ?out/i.test(err.message);
  }

  private describeEmptyPlaylist(playlistId: string): string {
    return `La playlist de Spotify existe pero está vacía: no contiene canciones (id: ${playlistId}).`;
  }

  private describeNotFound(playlistId: string): string {
    return `La playlist de Spotify no existe, fue eliminada o es privada (id: ${playlistId}).`;
  }

  private describePrivate(playlistId: string): string {
    return `La playlist de Spotify es privada o no está disponible para cuentas anónimas (id: ${playlistId}).`;
  }

  /**
   * Obtiene un token de aplicación con el flujo Client Credentials.
   */
  private async fetchClientCredentialsToken(
    clientId: string,
    clientSecret: string
  ): Promise<string> {
    const credentials = `${clientId}:${clientSecret}`;
    const basicAuth =
      typeof Buffer !== 'undefined'
        ? Buffer.from(credentials, 'utf8').toString('base64')
        : btoa(credentials);

    const response = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      throw new Error(this.describeHttpError(response.status));
    }

    const payload = await response.json();
    const token = payload?.access_token;
    if (typeof token !== 'string' || token.length === 0) {
      throw new Error('Spotify no devolvió un token de acceso válido.');
    }
    return token;
  }

  /**
   * Descarga la playlist con la Web API y recorre las páginas de `next`
   * hasta agotar las canciones.
   */
  private async fetchPlaylistViaApi(
    playlistId: string,
    accessToken: string
  ): Promise<ExtractorResult> {
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Accept-Language': 'en-US,en;q=0.9',
    };

    const firstResponse = await fetch(`${API_BASE_URL}/playlists/${playlistId}`, { headers });
    if (!firstResponse.ok) {
      throw new Error(this.describeHttpError(firstResponse.status));
    }

    const playlist = await firstResponse.json();
    const tracks: ExtractedTrack[] = [];
    const seenIds = new Set<string>();

    this.collectApiTracks(playlist?.tracks?.items, tracks, seenIds);

    let nextUrl: string | null =
      typeof playlist?.tracks?.next === 'string' ? playlist.tracks.next : null;
    let page = 1;

    while (nextUrl && page < MAX_API_PAGES) {
      const pageResponse = await fetch(nextUrl, { headers });
      if (!pageResponse.ok) break;

      const pageData = await pageResponse.json();
      const countBefore = tracks.length;
      this.collectApiTracks(pageData?.items, tracks, seenIds);

      if (tracks.length === countBefore) break;

      nextUrl = typeof pageData?.next === 'string' ? pageData.next : null;
      page++;
    }

    return {
      platform: 'spotify',
      playlistId,
      playlistTitle:
        typeof playlist?.name === 'string' && playlist.name
          ? playlist.name
          : 'Playlist de Spotify',
      totalTracks: tracks.length,
      tracks,
    };
  }

  /**
   * Extrae del modo anónimo usando el embed público y, si hace falta, la página
   * pública completa. Distingue entre playlist inexistente/privada, vacía y
   * fallos de red para devolver siempre un error descriptivo.
   */
  private async extractAnonymously(playlistId: string): Promise<ExtractorResult> {
    const embedPage = await this.fetchHtmlPage(`${EMBED_PAGE_BASE}/${playlistId}`);
    let firstNetworkError: Error | null = embedPage.networkError;
    let sawHttpNotFound = embedPage.status === 404;
    let sawHttpPrivate = embedPage.status === 401 || embedPage.status === 403;

    if (embedPage.html) {
      const nextData = this.parseNextData(embedPage.html);

      if (nextData) {
        const pageProps = nextData?.props?.pageProps;
        const status = typeof pageProps?.status === 'number' ? pageProps.status : undefined;
        if (status === 404) {
          throw new Error(this.describeNotFound(playlistId));
        }
        if (status === 401 || status === 403) {
          throw new Error(this.describePrivate(playlistId));
        }

        // 2a) Mejor esfuerzo: token de sesión anónimo del embed para la Web API.
        // Si Spotify limita el cupo (429) se continúa con el scraping del embed.
        const anonymousToken = this.readAnonymousToken(nextData);
        if (anonymousToken) {
          try {
            const viaApi = await this.fetchPlaylistViaApi(playlistId, anonymousToken);
            if (viaApi.tracks.length > 0) return viaApi;
          } catch (err: any) {
            // Un 404/403 con token anónimo no descarta el scraping del embed.
            if (!/HTTP (401|403|404|429)/.test(err?.message || '')) {
              console.warn(
                '[SpotifyExtractor] El token anónimo no pudo usar la Web API, se hace scraping del embed:',
                err?.message || err
              );
            }
          }
        }

        // 2b) Estado del recurso embebido en __NEXT_DATA__ (hasta 100 canciones)
        const entity = pageProps?.state?.data?.entity;
        const scraped = this.mapEmbedEntity(nextData, playlistId);
        if (scraped) return scraped;

        // El embed respondió con la playlist pero sin pistas: está vacía.
        if (entity && Array.isArray(entity.trackList) && entity.trackList.length === 0) {
          throw new Error(this.describeEmptyPlaylist(playlistId));
        }
      }
    }

    // 2c) Último recurso: página pública completa (initialState / __NEXT_DATA__)
    const publicPage = await this.extractFromPublicPage(playlistId);
    if (publicPage.result) return publicPage.result;
    firstNetworkError = firstNetworkError || publicPage.networkError;
    sawHttpNotFound = sawHttpNotFound || publicPage.httpStatus === 404;
    sawHttpPrivate =
      sawHttpPrivate || publicPage.httpStatus === 401 || publicPage.httpStatus === 403;

    // Sin HTML útil en ninguna de las dos rutas: decide el error más probable.
    // `httpStatus === null` en la página pública significa que el fetch falló por red.
    if (firstNetworkError && !embedPage.html && publicPage.httpStatus === null) {
      throw firstNetworkError;
    }
    if (sawHttpPrivate) {
      throw new Error(this.describePrivate(playlistId));
    }
    if (sawHttpNotFound) {
      throw new Error(this.describeNotFound(playlistId));
    }

    throw new Error(
      `No se pudo extraer la playlist de Spotify (id: ${playlistId}). Verifica que sea una playlist pública y que el enlace sea correcto.`
    );
  }

  private async fetchHtmlPage(
    url: string
  ): Promise<{ html: string | null; status: number | null; networkError: Error | null }> {
    try {
      const response = await fetch(url, { headers: SPOTIFY_PAGE_HEADERS, redirect: 'follow' });
      if (!response.ok) {
        return { html: null, status: response.status, networkError: null };
      }
      return { html: await response.text(), status: response.status, networkError: null };
    } catch (err: any) {
      console.warn(`[SpotifyExtractor] No se pudo consultar ${url}:`, err?.message || err);
      const networkError = err instanceof Error ? err : new Error(String(err));
      return { html: null, status: null, networkError };
    }
  }

  private parseNextData(html: string): any {
    const match = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!match) return null;

    try {
      return JSON.parse(match[1]);
    } catch {
      return null;
    }
  }

  private readAnonymousToken(nextData: any): string | null {
    const session = nextData?.props?.pageProps?.state?.settings?.session;
    const token = session?.accessToken;
    if (typeof token !== 'string' || token.length === 0) return null;

    const expiresAt = session?.accessTokenExpirationTimestampMs;
    if (typeof expiresAt === 'number' && expiresAt <= Date.now()) return null;

    return token;
  }

  /**
   * Mapea el estado del embed (`state.data.entity`) que trae título y trackList.
   */
  private mapEmbedEntity(nextData: any, playlistId: string): ExtractorResult | null {
    const entity = nextData?.props?.pageProps?.state?.data?.entity;
    if (!entity || !Array.isArray(entity.trackList)) return null;

    const tracks: ExtractedTrack[] = [];
    const seenIds = new Set<string>();

    for (const item of entity.trackList) {
      const track = this.mapEmbedTrack(item, tracks.length);
      if (!track || seenIds.has(track.id)) continue;

      seenIds.add(track.id);
      tracks.push(track);
    }

    if (tracks.length === 0) return null;

    const playlistTitle = entity.title || entity.name;
    return {
      platform: 'spotify',
      playlistId,
      playlistTitle:
        typeof playlistTitle === 'string' && playlistTitle
          ? playlistTitle
          : 'Playlist de Spotify',
      totalTracks: tracks.length,
      tracks,
    };
  }

  private mapEmbedTrack(item: any, index: number): ExtractedTrack | null {
    if (!item || typeof item !== 'object') return null;
    if (item.entityType && item.entityType !== 'track') return null;

    const title = typeof item.title === 'string' ? item.title.trim() : '';
    if (!title) return null;

    const uri = typeof item.uri === 'string' ? item.uri : '';
    const id = uri.startsWith('spotify:track:')
      ? uri.slice('spotify:track:'.length)
      : uri || `spotify-track-${index + 1}`;

    const artists = splitArtistNames(item.subtitle);
    const mainArtist = artists[0] || 'Artista Desconocido';
    const durationMs = typeof item.duration === 'number' ? item.duration : undefined;

    return {
      id,
      title,
      mainArtist,
      allArtists: artists.length > 0 ? artists : [mainArtist],
      durationMs,
      durationText: formatDurationText(durationMs),
    };
  }

  /**
   * Página pública completa: intenta __NEXT_DATA__ y, si no existe, el
   * `initialState` codificado en base64 que usa el reproductor web.
   */
  private async extractFromPublicPage(
    playlistId: string
  ): Promise<{ result: ExtractorResult | null; httpStatus: number | null; networkError: Error | null }> {
    const page = await this.fetchHtmlPage(`${PUBLIC_PAGE_BASE}/${playlistId}`);
    if (!page.html) {
      return { result: null, httpStatus: page.status, networkError: page.networkError };
    }

    const html = page.html;
    const nextData = this.parseNextData(html);
    if (nextData) {
      const status = nextData?.props?.pageProps?.status;
      if (status === 404) {
        throw new Error(this.describeNotFound(playlistId));
      }
      if (status === 401 || status === 403) {
        throw new Error(this.describePrivate(playlistId));
      }

      const fromEntity = this.mapEmbedEntity(nextData, playlistId);
      if (fromEntity) return { result: fromEntity, httpStatus: page.status, networkError: null };
    }

    return {
      result: this.mapInitialState(html, playlistId),
      httpStatus: page.status,
      networkError: null,
    };
  }

  private mapInitialState(html: string, playlistId: string): ExtractorResult | null {
    const match = html.match(/<script[^>]*id="initialState"[^>]*>([\s\S]*?)<\/script>/);
    if (!match) return null;

    const state = this.decodeBase64Json(match[1]);
    const playlist = state?.entities?.items?.[`spotify:playlist:${playlistId}`];
    if (!playlist) return null;

    const tracks: ExtractedTrack[] = [];
    const seenIds = new Set<string>();

    if (Array.isArray(playlist?.content?.items)) {
      for (const entry of playlist.content.items) {
        const track = this.mapWebStateTrack(entry?.itemV2?.data, tracks.length);
        if (!track || seenIds.has(track.id)) continue;

        seenIds.add(track.id);
        tracks.push(track);
      }
    }

    if (tracks.length === 0) return null;

    const playlistTitle =
      typeof playlist?.name === 'string' && playlist.name
        ? playlist.name
        : this.extractTitleFromHtml(html) || 'Playlist de Spotify';

    return {
      platform: 'spotify',
      playlistId,
      playlistTitle,
      totalTracks: tracks.length,
      tracks,
    };
  }

  private mapWebStateTrack(data: any, index: number): ExtractedTrack | null {
    if (!data || typeof data !== 'object') return null;

    const title = typeof data.name === 'string' ? data.name.trim() : '';
    if (!title) return null;

    const uri = typeof data.uri === 'string' ? data.uri : '';
    const id = uri.startsWith('spotify:track:')
      ? uri.slice('spotify:track:'.length)
      : uri || `spotify-track-${index + 1}`;

    const artists: string[] = [];
    if (Array.isArray(data.artists?.items)) {
      for (const artist of data.artists.items) {
        const name = typeof artist?.profile?.name === 'string' ? artist.profile.name.trim() : '';
        if (name && !artists.includes(name)) artists.push(name);
      }
    }

    const mainArtist = artists[0] || 'Artista Desconocido';
    const durationMs =
      typeof data.duration?.totalMilliseconds === 'number'
        ? data.duration.totalMilliseconds
        : undefined;
    const coverUrl =
      typeof data.albumOfTrack?.coverArt?.sources?.[0]?.url === 'string'
        ? data.albumOfTrack.coverArt.sources[0].url
        : undefined;

    return {
      id,
      title,
      mainArtist,
      allArtists: artists.length > 0 ? artists : [mainArtist],
      durationMs,
      durationText: formatDurationText(durationMs),
      coverUrl,
      thumbnailUrl: coverUrl,
      albumName:
        typeof data.albumOfTrack?.name === 'string' && data.albumOfTrack.name
          ? data.albumOfTrack.name
          : undefined,
    };
  }

  private decodeBase64Json(encoded: string): any {
    try {
      let jsonText: string;
      if (typeof Buffer !== 'undefined') {
        jsonText = Buffer.from(encoded, 'base64').toString('utf8');
      } else {
        const binary = atob(encoded);
        const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
        jsonText = new TextDecoder('utf-8').decode(bytes);
      }
      return JSON.parse(jsonText);
    } catch {
      return null;
    }
  }

  private extractTitleFromHtml(html: string): string | null {
    const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    if (!match) return null;

    const title = match[1]
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;|&#39;/g, "'")
      .replace(/\s*\|\s*Spotify\s+Playlist\s*$/i, '')
      .trim();

    return title || null;
  }

  private collectApiTracks(
    items: any,
    tracks: ExtractedTrack[],
    seenIds: Set<string>
  ): void {
    if (!Array.isArray(items)) return;

    for (const entry of items) {
      const track = entry?.track;
      // Ignora huecos vacíos y episodios de podcast (no son canciones)
      if (!track || typeof track !== 'object') continue;
      if (track.type === 'episode') continue;

      const uri = typeof track.uri === 'string' ? track.uri : '';
      const id =
        (typeof track.id === 'string' && track.id) || uri || `spotify-track-${tracks.length + 1}`;
      if (seenIds.has(id)) continue;

      const title = typeof track.name === 'string' ? track.name.trim() : '';
      if (!title) continue;

      const artists: string[] = [];
      if (Array.isArray(track.artists)) {
        for (const artist of track.artists) {
          const name = typeof artist?.name === 'string' ? artist.name.trim() : '';
          if (name && !artists.includes(name)) artists.push(name);
        }
      }

      const mainArtist = artists[0] || 'Artista Desconocido';
      const coverUrl =
        typeof track.album?.images?.[0]?.url === 'string'
          ? track.album.images[0].url
          : undefined;
      const durationMs =
        typeof track.duration_ms === 'number' ? track.duration_ms : undefined;

      seenIds.add(id);
      tracks.push({
        id,
        title,
        mainArtist,
        allArtists: artists.length > 0 ? artists : [mainArtist],
        durationMs,
        durationText: formatDurationText(durationMs),
        coverUrl,
        thumbnailUrl: coverUrl,
        albumName:
          typeof track.album?.name === 'string' && track.album.name
            ? track.album.name
            : undefined,
      });
    }
  }

  private describeHttpError(status: number): string {
    if (status === 401) {
      return 'Error HTTP 401 de Spotify: credenciales inválidas o token expirado.';
    }
    if (status === 403) {
      return 'Error HTTP 403 de Spotify: la playlist es privada o no está disponible.';
    }
    if (status === 404) {
      return 'Error HTTP 404 de Spotify: la playlist no existe o es privada.';
    }
    if (status === 429) {
      return 'Error HTTP 429 de Spotify: se superó el límite de peticiones. Intenta de nuevo en unos minutos.';
    }
    return `Error HTTP ${status} de Spotify.`;
  }
}

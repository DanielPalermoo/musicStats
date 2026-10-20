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

// URI de Spotify: spotify:playlist:{id} y el formato legado spotify:user:{user}:playlist:{id}
const PLAYLIST_URI_PATTERN =
  /^(?:spotify:user:[^:/?#]+:playlist:|spotify:playlist:)([A-Za-z0-9]{22})$/i;

// Rutas web: /playlist/{id}, /intl-es/playlist/{id}, /embed/playlist/{id}, /user/{user}/playlist/{id}
const PLAYLIST_PATH_PATTERN =
  /^\/(?:intl-[a-z]{2}(?:-[a-z]{2,4})?\/)?(?:embed\/|user\/[^/]+\/)?playlist\/([A-Za-z0-9]{22})(?:\/|$)/i;

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

    const uriMatch = trimmed.match(PLAYLIST_URI_PATTERN);
    if (uriMatch) return uriMatch[1];

    try {
      const parsed = new URL(trimmed);
      const host = parsed.hostname.toLowerCase();
      if (host !== 'open.spotify.com' && host !== 'www.open.spotify.com') return null;

      const pathMatch = parsed.pathname.match(PLAYLIST_PATH_PATTERN);
      return pathMatch ? pathMatch[1] : null;
    } catch {
      return null;
    }
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

    if (clientId && clientSecret) {
      try {
        const token = await this.fetchClientCredentialsToken(clientId, clientSecret);
        return await this.fetchPlaylistViaApi(playlistId, token);
      } catch (err: any) {
        console.warn(
          '[SpotifyExtractor] La API con credenciales falló, se usa el fallback anónimo:',
          err?.message || err
        );
      }
    }

    // 2) Fallback anónimo: embed público + página pública
    return this.extractAnonymously(playlistId);
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
   * pública completa.
   */
  private async extractAnonymously(playlistId: string): Promise<ExtractorResult> {
    const embedHtml = await this.fetchHtmlPage(`${EMBED_PAGE_BASE}/${playlistId}`);

    if (embedHtml) {
      const nextData = this.parseNextData(embedHtml);

      if (nextData) {
        const pageProps = nextData?.props?.pageProps;
        if (pageProps?.status === 404) {
          throw new Error(
            `La playlist de Spotify no existe o fue eliminada (id: ${playlistId}).`
          );
        }

        // 2a) Mejor esfuerzo: token de sesión anónimo del embed para la Web API.
        // Si Spotify limita el cupo (429) se continúa con el scraping del embed.
        const anonymousToken = this.readAnonymousToken(nextData);
        if (anonymousToken) {
          try {
            const viaApi = await this.fetchPlaylistViaApi(playlistId, anonymousToken);
            if (viaApi.tracks.length > 0) return viaApi;
          } catch (err: any) {
            console.warn(
              '[SpotifyExtractor] El token anónimo no pudo usar la Web API, se hace scraping del embed:',
              err?.message || err
            );
          }
        }

        // 2b) Estado del recurso embebido en __NEXT_DATA__ (hasta 100 canciones)
        const scraped = this.mapEmbedEntity(nextData, playlistId);
        if (scraped) return scraped;
      }
    }

    // 2c) Último recurso: página pública completa (initialState / __NEXT_DATA__)
    const fromPublicPage = await this.extractFromPublicPage(playlistId);
    if (fromPublicPage) return fromPublicPage;

    throw new Error(
      'No se pudo extraer la playlist de Spotify. Verifica que sea una playlist pública y que el enlace sea correcto.'
    );
  }

  private async fetchHtmlPage(url: string): Promise<string | null> {
    try {
      const response = await fetch(url, { headers: SPOTIFY_PAGE_HEADERS, redirect: 'follow' });
      if (!response.ok) return null;
      return await response.text();
    } catch (err: any) {
      console.warn(`[SpotifyExtractor] No se pudo consultar ${url}:`, err?.message || err);
      return null;
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
  private async extractFromPublicPage(playlistId: string): Promise<ExtractorResult | null> {
    const html = await this.fetchHtmlPage(`${PUBLIC_PAGE_BASE}/${playlistId}`);
    if (!html) return null;

    const nextData = this.parseNextData(html);
    if (nextData) {
      const fromEntity = this.mapEmbedEntity(nextData, playlistId);
      if (fromEntity) return fromEntity;
    }

    return this.mapInitialState(html, playlistId);
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

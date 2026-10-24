import { ExtractedTrack, ExtractorResult, PlaylistExtractor } from '@/types/playlist';

const SITE_BASE_URL = 'https://soundcloud.com';
const WIDGET_BASE_URL = 'https://w.soundcloud.com/player/';
const API_V2_BASE_URL = 'https://api-v2.soundcloud.com';

const MAX_API_PAGES = 30; // Hasta ~6000 canciones de seguridad (páginas de 200)
const MAX_TRACKS = 5000; // Límite duro de seguridad contra respuestas malformadas

const SOUNDCLOUD_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
};

const API_HEADERS = {
  'User-Agent': SOUNDCLOUD_HEADERS['User-Agent'],
  Accept: 'application/json,text/plain,*/*',
  'Accept-Language': SOUNDCLOUD_HEADERS['Accept-Language'],
};

// /{usuario}/sets/{slug} y /sets/{slug}
const SET_PATH_PATTERN = /^\/([^/]+)\/sets\/([^/?#]+)/i;
const BARE_SET_PATH_PATTERN = /^\/sets\/([^/?#]+)/i;

// Rutas del sitio que nunca son un usuario real (evita falsos positivos).
const RESERVED_SEGMENTS = new Set([
  'discover',
  'search',
  'you',
  'stream',
  'upload',
  'charts',
  'popular',
  'tags',
  'groups',
  'settings',
  'notifications',
  'messages',
  'library',
  'likes',
  'following',
  'followers',
  'pages',
  'pro',
  'premium',
  'artists',
  'playlists',
  'albums',
  'tracks',
  'imprint',
  'jobs',
]);

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
 * Las portadas de SoundCloud usan sufijos de tamaño (-large, -t200x200...).
 * Se normaliza a 500x500 cuando es posible.
 */
function normalizeArtwork(url?: string | null): string | undefined {
  if (typeof url !== 'string' || !url) return undefined;
  return url.replace(/-(?:large|t\d+x\d+|mini|small|badge)\.(jpg|jpeg|png|webp)$/i, '-t500x500.$1');
}

/**
 * Convierte una entrada de SoundCloud (hidratación, API v2 o widget) al formato común.
 */
function mapSoundCloudTrack(
  item: any,
  index: number,
  playlistArtwork?: string | null
): ExtractedTrack | null {
  if (!item || typeof item !== 'object') return null;

  const title = typeof item.title === 'string' ? item.title.trim() : '';
  if (!title) return null;

  const uploader = typeof item.user?.username === 'string' ? item.user.username.trim() : '';
  const publishedArtist =
    typeof item.publisher_metadata?.artist === 'string'
      ? item.publisher_metadata.artist.trim()
      : '';
  const mainArtist = publishedArtist || uploader || 'Artista Desconocido';

  const durationMs =
    typeof item.duration === 'number'
      ? item.duration
      : typeof item.full_duration === 'number'
        ? item.full_duration
        : undefined;

  const coverUrl =
    normalizeArtwork(item.artwork_url) ?? normalizeArtwork(playlistArtwork) ?? undefined;

  return {
    id:
      typeof item.id === 'number' || typeof item.id === 'string'
        ? String(item.id)
        : `soundcloud-track-${index + 1}`,
    title,
    mainArtist,
    allArtists: [mainArtist],
    durationMs: durationMs && durationMs > 0 ? durationMs : undefined,
    durationText: formatDurationText(durationMs),
    coverUrl,
    thumbnailUrl: coverUrl,
    albumName:
      typeof item.publisher_metadata?.album_title === 'string' &&
      item.publisher_metadata.album_title
        ? item.publisher_metadata.album_title
        : undefined,
  };
}

/**
 * Extractor de sets/playlists públicas de SoundCloud.
 *
 * Estrategia en cascada, con manejo defensivo de errores:
 * 1. Se descarga la página pública del set y se lee el estado embebido
 *    (`window.__sc_hydration`), que incluye título, portada y todas las pistas.
 * 2. Si no hay hidratación, se extrae el `client_id` público de la página y se
 *    resuelve el set con la API v2 (`/resolve` + `/playlists/{id}/tracks`).
 * 3. Como último recurso se consulta el reproductor/widget público de SoundCloud.
 */
export class SoundCloudExtractor implements PlaylistExtractor {
  readonly platform = 'soundcloud' as const;

  canHandle(url: string): boolean {
    const parsed = this.parseUrl(url);
    if (!parsed) return false;

    const host = this.normalizeHost(parsed.hostname);
    if (this.isShortHost(host)) {
      return parsed.pathname.replace(/\//g, '').length > 0;
    }
    if (!this.isSiteHost(host)) return false;

    return this.extractPlaylistIdFromParsed(parsed) !== null;
  }

  extractPlaylistId(url: string): string | null {
    const parsed = this.parseUrl(url);
    if (!parsed) return null;

    const host = this.normalizeHost(parsed.hostname);
    if (!this.isSiteHost(host)) return null;

    return this.extractPlaylistIdFromParsed(parsed);
  }

  async extract(url: string): Promise<ExtractorResult> {
    let parsed = this.parseUrl(url);
    const invalidUrlError =
      'URL de SoundCloud inválida. Acepta enlaces como https://soundcloud.com/usuario/sets/mi-playlist.';
    if (!parsed) {
      throw new Error(invalidUrlError);
    }

    const host = this.normalizeHost(parsed.hostname);

    // Enlaces cortos (on.soundcloud.com): se sigue la redirección hasta el set.
    if (this.isShortHost(host)) {
      parsed = await this.resolveShortLink(parsed.toString());
    } else if (!this.isSiteHost(host)) {
      throw new Error(invalidUrlError);
    }

    const playlistId = parsed ? this.extractPlaylistIdFromParsed(parsed) : null;
    if (!playlistId) {
      throw new Error(
        'URL de SoundCloud inválida. Asegúrate de que sea un set o playlist pública: https://soundcloud.com/usuario/sets/nombre-del-set.'
      );
    }

    const setUrl = this.buildSetUrl(playlistId);
    return this.extractFromSet(playlistId, setUrl);
  }

  /**
   * Normaliza URLs con o sin esquema ("soundcloud.com/user/sets/x").
   */
  private parseUrl(rawUrl: string): URL | null {
    const trimmed = rawUrl.trim();
    if (!trimmed) return null;

    try {
      return new URL(trimmed);
    } catch {
      if (/^[\w.-]+\.[a-z]{2,}(?:[/?#]|$)/i.test(trimmed)) {
        try {
          return new URL(`https://${trimmed}`);
        } catch {
          return null;
        }
      }
      return null;
    }
  }

  private normalizeHost(hostname: string): string {
    return hostname.replace(/^www\./i, '').toLowerCase();
  }

  private isSiteHost(host: string): boolean {
    return host === 'soundcloud.com' || host === 'm.soundcloud.com';
  }

  private isShortHost(host: string): boolean {
    return host === 'on.soundcloud.com';
  }

  private extractPlaylistIdFromParsed(parsed: URL): string | null {
    const setMatch = parsed.pathname.match(SET_PATH_PATTERN);
    if (setMatch) {
      const user = this.decodeSegment(setMatch[1]);
      const slug = this.decodeSegment(setMatch[2]);
      if (!user || !slug || RESERVED_SEGMENTS.has(user.toLowerCase())) return null;
      return `${user}/sets/${slug}`;
    }

    const bareMatch = parsed.pathname.match(BARE_SET_PATH_PATTERN);
    if (bareMatch) {
      const slug = this.decodeSegment(bareMatch[1]);
      return slug ? `sets/${slug}` : null;
    }

    return null;
  }

  private decodeSegment(segment: string): string {
    try {
      return decodeURIComponent(segment).trim();
    } catch {
      return segment.trim();
    }
  }

  private buildSetUrl(playlistId: string): string {
    return `${SITE_BASE_URL}/${playlistId}`;
  }

  /**
   * Sigue un enlace corto y devuelve la URL final del set.
   */
  private async resolveShortLink(url: string): Promise<URL> {
    let response: any;
    try {
      response = await fetch(url, { headers: SOUNDCLOUD_HEADERS, redirect: 'follow' });
    } catch (err: any) {
      throw err instanceof Error ? err : new Error(String(err));
    }

    const finalUrl: string =
      (typeof response?.url === 'string' && response.url) ||
      (typeof response?.headers?.get === 'function' ? response.headers.get('location') : '') ||
      '';

    const parsedFinal = finalUrl ? this.parseUrl(finalUrl) : null;
    if (parsedFinal && this.extractPlaylistIdFromParsed(parsedFinal)) {
      return parsedFinal;
    }

    // Algunos enlaces cortos exponen la URL canónica en el HTML.
    if (response?.ok && typeof response.text === 'function') {
      const body = await response.text().catch(() => '');
      const bodyMatch =
        typeof body === 'string'
          ? body.match(/https?:\/\/(?:www\.)?soundcloud\.com\/[^"'\s<>]+\/sets\/[^"'\s<>?#]+/i)
          : null;
      if (bodyMatch) {
        const parsedBody = this.parseUrl(bodyMatch[0]);
        if (parsedBody && this.extractPlaylistIdFromParsed(parsedBody)) return parsedBody;
      }
    }

    throw new Error(
      'No se pudo resolver el enlace corto de SoundCloud. Copia el enlace completo del set (https://soundcloud.com/usuario/sets/nombre-del-set).'
    );
  }

  private async extractFromSet(
    playlistId: string,
    setUrl: string
  ): Promise<ExtractorResult> {
    const page = await this.fetchHtmlPage(setUrl);

    if (page.networkError) throw page.networkError;

    if (page.status === 404) {
      throw new Error(
        `El set de SoundCloud no existe, fue eliminado o es privado (${playlistId}).`
      );
    }
    if (page.status === 401 || page.status === 403) {
      throw new Error(
        `El set de SoundCloud es privado o no está disponible públicamente (${playlistId}).`
      );
    }
    if (!page.html) {
      throw new Error(this.describeHttpError(page.status, playlistId));
    }

    // 1) Estado embebido en el HTML público del set.
    const hydratedPlaylist = this.findPlaylist(this.parseHydration(page.html));
    if (hydratedPlaylist) {
      const hydratedWithTracks = await this.hydrateTrackStubs(hydratedPlaylist, page.html);
      const result = this.mapPlaylist(hydratedWithTracks, playlistId);
      if (result) return result;

      // El set existe pero está vacío: no tiene sentido intentar la API.
      if (Array.isArray(hydratedPlaylist.tracks) && hydratedPlaylist.tracks.length === 0) {
        throw new Error(
          `El set de SoundCloud existe pero no contiene canciones (${playlistId}).`
        );
      }
    }

    const errors: Error[] = [];

    // 2) API v2 con el client_id público extraído de la propia página.
    const clientId = await this.resolveClientId(page.html);
    if (clientId) {
      try {
        return await this.fetchViaApiV2(setUrl, playlistId, clientId);
      } catch (err: any) {
        errors.push(err instanceof Error ? err : new Error(String(err)));
      }
    }

    // 3) Widget público de SoundCloud.
    try {
      const fromWidget = await this.extractFromWidget(setUrl, playlistId);
      if (fromWidget) return fromWidget;
    } catch (err: any) {
      errors.push(err instanceof Error ? err : new Error(String(err)));
    }

    throw this.describeExtractionFailure(playlistId, errors);
  }

  private async fetchHtmlPage(
    url: string
  ): Promise<{ html: string | null; status: number | null; networkError: Error | null }> {
    try {
      const response = await fetch(url, { headers: SOUNDCLOUD_HEADERS, redirect: 'follow' });
      if (!response.ok) {
        return { html: null, status: response.status, networkError: null };
      }
      return { html: await response.text(), status: response.status, networkError: null };
    } catch (err: any) {
      const networkError = err instanceof Error ? err : new Error(String(err));
      return { html: null, status: null, networkError };
    }
  }

  /**
   * Extrae el JSON de `window.__sc_hydration` equilibrando corchetes, para no
   * cortar en un `]` que aparezca dentro de un título o descripción.
   */
  private parseHydration(html: string): any[] {
    const marker = html.indexOf('window.__sc_hydration');
    if (marker < 0) return [];

    const start = html.indexOf('[', marker);
    if (start < 0) return [];

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = start; i < html.length; i++) {
      const char = html[i];

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (char === '\\') {
          escaped = true;
        } else if (char === '"') {
          inString = false;
        }
        continue;
      }

      if (char === '"') {
        inString = true;
      } else if (char === '[') {
        depth++;
      } else if (char === ']') {
        depth--;
        if (depth === 0) {
          const raw = html.slice(start, i + 1);
          try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        }
      }
    }

    return [];
  }

  private findPlaylist(hydration: any[]): any | null {
    if (!Array.isArray(hydration)) return null;

    for (const entry of hydration) {
      const data = entry?.data;
      const hydratable = typeof entry?.hydratable === 'string' ? entry.hydratable : '';

      if (hydratable === 'playlist' && data && typeof data === 'object') return data;
      if (data?.kind === 'playlist' && Array.isArray(data?.tracks)) return data;
    }

    return null;
  }

  private mapPlaylist(playlist: any, playlistId: string): ExtractorResult | null {
    const rawTracks = Array.isArray(playlist?.tracks)
      ? playlist.tracks
      : Array.isArray(playlist?.collection)
        ? playlist.collection
        : [];

    const tracks: ExtractedTrack[] = [];
    const seenIds = new Set<string>();

    for (const item of rawTracks) {
      if (tracks.length >= MAX_TRACKS) break;

      const track = mapSoundCloudTrack(item, tracks.length, playlist?.artwork_url);
      if (!track || seenIds.has(track.id)) continue;

      seenIds.add(track.id);
      tracks.push(track);
    }

    if (tracks.length === 0) return null;

    const title =
      typeof playlist?.title === 'string' && playlist.title.trim()
        ? playlist.title.trim()
        : typeof playlist?.permalink === 'string' && playlist.permalink
          ? playlist.permalink
          : 'Playlist de SoundCloud';

    return {
      platform: 'soundcloud',
      playlistId,
      playlistTitle: title,
      totalTracks: tracks.length,
      tracks,
    };
  }

  /**
   * Determina si un elemento de la lista de tracks es un stub (contiene ID pero carece de título).
   */
  private isTrackStub(item: any): boolean {
    if (!item || typeof item !== 'object') return false;
    const hasId =
      typeof item.id === 'number' ||
      (typeof item.id === 'string' && item.id.trim().length > 0);
    const lacksTitle =
      item.title === undefined ||
      item.title === null ||
      (typeof item.title === 'string' && item.title.trim().length === 0);
    return hasId && lacksTitle;
  }

  /**
   * Hidrata en bloques de hasta 50 IDs las pistas que vienen incompletas (stubs) usando API v2.
   */
  private async hydrateTrackStubs(
    playlist: any,
    html?: string | null,
    knownClientId?: string | null
  ): Promise<any> {
    const rawTracks = Array.isArray(playlist?.tracks)
      ? playlist.tracks
      : Array.isArray(playlist?.collection)
        ? playlist.collection
        : [];

    if (!rawTracks.some((item: any) => this.isTrackStub(item))) {
      return playlist;
    }

    const clientId = knownClientId || (await this.resolveClientId(html));
    if (!clientId) {
      return playlist;
    }

    const stubIds: string[] = [];
    for (const item of rawTracks) {
      if (this.isTrackStub(item)) {
        stubIds.push(String(item.id));
      }
    }

    const uniqueStubIds = [...new Set(stubIds)];
    const fetchedMap = new Map<string, any>();
    const CHUNK_SIZE = 50;

    for (let i = 0; i < uniqueStubIds.length; i += CHUNK_SIZE) {
      const chunk = uniqueStubIds.slice(i, i + CHUNK_SIZE).join(',');
      try {
        const url = `${API_V2_BASE_URL}/tracks?ids=${chunk}&client_id=${encodeURIComponent(clientId)}`;
        const response = await fetch(url, { headers: API_HEADERS });
        if (response.ok) {
          const items = await response.json();
          if (Array.isArray(items)) {
            for (const item of items) {
              if (item && item.id !== undefined && item.id !== null) {
                fetchedMap.set(String(item.id), item);
              }
            }
          }
        }
      } catch (err) {
        // Continuar defensivamente si un lote falla
      }
    }

    const hydratedTracks = rawTracks.map((item: any) => {
      if (this.isTrackStub(item)) {
        const full = fetchedMap.get(String(item.id));
        return full ?? item;
      }
      return item;
    });

    return {
      ...playlist,
      tracks: hydratedTracks,
    };
  }

  /**
   * Obtiene el client_id público buscando en el HTML y luego en los scripts referenciados.
   */
  private async resolveClientId(html?: string | null): Promise<string | null> {
    if (!html || typeof html !== 'string') return null;

    const direct = this.extractClientId(html);
    if (direct) return direct;

    const scriptUrls = this.extractScriptUrls(html);
    for (const scriptUrl of scriptUrls) {
      try {
        const response = await fetch(scriptUrl, { headers: SOUNDCLOUD_HEADERS });
        if (response.ok) {
          const content = await response.text();
          const fromScript = this.extractClientId(content);
          if (fromScript) return fromScript;
        }
      } catch {
        // Continuar con el siguiente script si uno falla
      }
    }

    return null;
  }

  private extractScriptUrls(html: string): string[] {
    const urls: string[] = [];
    const scriptRegex = /<script[^>]+src=["']([^"']+\.js(?:[^"']*)?)["']/gi;
    let match: RegExpExecArray | null;
    while ((match = scriptRegex.exec(html)) !== null) {
      const src = match[1];
      if (src && !urls.includes(src)) {
        urls.push(src);
      }
    }
    return urls;
  }

  /**
   * Busca el `client_id` público que SoundCloud publica en sus scripts.
   */
  private extractClientId(html: string): string | null {
    const patterns = [
      /client_id\s*[:=]\s*["']([A-Za-z0-9]{20,})["']/i,
      /"client_id"\s*:\s*"([A-Za-z0-9]{20,})"/i,
      /client_id=([A-Za-z0-9]{20,})/i,
      /clientId\s*[:=]\s*["']([A-Za-z0-9]{20,})["']/i,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) return match[1];
    }

    return null;
  }


  private async fetchViaApiV2(
    setUrl: string,
    playlistId: string,
    clientId: string
  ): Promise<ExtractorResult> {
    const resolveUrl = `${API_V2_BASE_URL}/resolve?url=${encodeURIComponent(
      setUrl
    )}&client_id=${encodeURIComponent(clientId)}`;

    let playlist: any;
    try {
      const response = await fetch(resolveUrl, { headers: API_HEADERS });
      if (!response.ok) {
        throw new Error(this.describeHttpError(response.status, playlistId));
      }
      playlist = await response.json();
    } catch (err: any) {
      throw err instanceof Error ? err : new Error(String(err));
    }

    if (!playlist || playlist.kind !== 'playlist') {
      throw new Error(
        `El enlace de SoundCloud no corresponde a un set o playlist pública (${playlistId}).`
      );
    }

    // Para sets grandes SoundCloud solo entrega las primeras pistas en `/resolve`
    // y marca la respuesta con `stub: true`; el resto se completa consultando el
    // endpoint de pistas del playlist.
    if (!playlist.stub) {
      const hydratedWithTracks = await this.hydrateTrackStubs(playlist, null, clientId);
      const direct = this.mapPlaylist(hydratedWithTracks, playlistId);
      if (direct) return direct;
    }

    if (playlist.id !== undefined && playlist.id !== null) {
      const rawTracks = await this.fetchPlaylistTracks(String(playlist.id), clientId);
      const completedPlaylist = await this.hydrateTrackStubs(
        { ...playlist, tracks: rawTracks },
        null,
        clientId
      );
      const completed = this.mapPlaylist(completedPlaylist, playlistId);
      if (completed) return completed;
    }

    throw new Error(`El set de SoundCloud existe pero no contiene canciones (${playlistId}).`);
  }

  private async fetchPlaylistTracks(playlistId: string, clientId: string): Promise<any[]> {
    const collected: any[] = [];
    const visited = new Set<string>();
    let nextUrl: string | null = `${API_V2_BASE_URL}/playlists/${encodeURIComponent(
      playlistId
    )}/tracks?client_id=${encodeURIComponent(clientId)}&limit=200`;
    let page = 1;

    while (nextUrl && page < MAX_API_PAGES && collected.length < MAX_TRACKS) {
      if (visited.has(nextUrl)) break;
      visited.add(nextUrl);

      const response: Response = await fetch(nextUrl, { headers: API_HEADERS });
      if (!response.ok) break;

      const payload = await response.json();
      const items: any[] = Array.isArray(payload?.collection)
        ? payload.collection
        : Array.isArray(payload)
          ? payload
          : [];

      collected.push(...items.slice(0, Math.max(0, MAX_TRACKS - collected.length)));

      const rawNext =
        typeof payload?.next_href === 'string' && payload.next_href ? payload.next_href : null;
      if (!rawNext || items.length === 0) break;

      const absolute = rawNext.startsWith('http')
        ? rawNext
        : `${API_V2_BASE_URL}${rawNext.startsWith('/') ? '' : '/'}${rawNext}`;
      nextUrl = absolute.includes('client_id=')
        ? absolute
        : `${absolute}${absolute.includes('?') ? '&' : '?'}client_id=${encodeURIComponent(
            clientId
          )}`;
      page++;
    }

    return collected.slice(0, MAX_TRACKS);
  }

  private async extractFromWidget(
    setUrl: string,
    playlistId: string
  ): Promise<ExtractorResult | null> {
    const widgetUrl = `${WIDGET_BASE_URL}?url=${encodeURIComponent(setUrl)}`;
    const response = await fetch(widgetUrl, { headers: SOUNDCLOUD_HEADERS });
    if (!response.ok) {
      throw new Error(this.describeHttpError(response.status, playlistId));
    }

    const html = await response.text();
    const playlist = this.findPlaylist(this.parseHydration(html));
    if (!playlist) return null;

    const hydratedWithTracks = await this.hydrateTrackStubs(playlist, html);
    return this.mapPlaylist(hydratedWithTracks, playlistId);
  }

  /**
   * Elige el error más descriptivo de los intentos fallidos.
   */
  private describeExtractionFailure(playlistId: string, errors: Error[]): Error {
    const notFound = errors.find((error) => /no existe|not found|404/i.test(error.message));
    if (notFound) return notFound;

    const privateError = errors.find((error) =>
      /privad|private|403|401|requiere iniciar sesi/i.test(error.message)
    );
    if (privateError) return privateError;

    const network = errors.find((error) =>
      /fetch failed|network|enotfound|econnrefused|econnreset|etimedout|eai_again|socket hang up|timed? ?out/i.test(
        error.message
      )
    );
    if (network) return network;

    return new Error(
      `No se pudo extraer el set de SoundCloud (${playlistId}). Verifica que sea público y que el enlace sea correcto.`
    );
  }

  private describeHttpError(status: number | null, playlistId: string): string {
    if (status === 404) {
      return `El set de SoundCloud no existe o el enlace es inválido (${playlistId}, HTTP 404).`;
    }
    if (status === 401 || status === 403) {
      return `El set de SoundCloud es privado o no está disponible (${playlistId}, HTTP ${status}).`;
    }
    if (status === 429) {
      return 'Error HTTP 429 de SoundCloud: se superó el límite de peticiones. Intenta de nuevo en unos minutos.';
    }
    return `Error HTTP ${status ?? 'desconocido'} al consultar el set de SoundCloud (${playlistId}).`;
  }
}

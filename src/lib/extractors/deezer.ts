import { ExtractedTrack, ExtractorResult, PlaylistExtractor } from '@/types/playlist';

const API_BASE_URL = 'https://api.deezer.com';
const MAX_PAGES = 30; // Hasta ~3000 canciones de seguridad (páginas de 25/100)
const MAX_TRACKS = 5000; // Límite duro de seguridad contra respuestas malformadas

const DEEZER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
  Accept: 'application/json,text/plain,*/*',
  'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
};

// Rutas web: /playlist/{id}, /es/playlist/{id}, /intl-es/playlist/{id},
// /en/playlist/{id} y variantes con query params de tracking.
const PLAYLIST_PATH_PATTERN =
  /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?playlist\/(\d+)(?:\/|$)/i;

/**
 * Convierte segundos a texto legible: "3:44" o "1:02:05".
 */
function formatDurationText(durationSec?: number): string | undefined {
  if (typeof durationSec !== 'number' || !Number.isFinite(durationSec) || durationSec <= 0) {
    return undefined;
  }

  const totalSeconds = Math.round(durationSec);
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
 * Convierte una entrada de Deezer en el formato común de la aplicación.
 */
function mapDeezerTrack(item: any, index: number): ExtractedTrack | null {
  if (!item || typeof item !== 'object') return null;

  const title = typeof item.title === 'string' ? item.title.trim() : '';
  if (!title) return null;

  // Deezer puede devolver un track "no legible" (solo id/título) por restricciones
  // de licencia; se conserva igualmente para no perder la canción de la playlist.
  const artists: string[] = [];
  const artistName = typeof item.artist?.name === 'string' ? item.artist.name.trim() : '';
  if (artistName) artists.push(artistName);

  if (Array.isArray(item.contributors)) {
    for (const contributor of item.contributors) {
      const name = typeof contributor?.name === 'string' ? contributor.name.trim() : '';
      if (name && !artists.includes(name)) artists.push(name);
    }
  }

  const mainArtist = artists[0] || 'Artista Desconocido';
  const durationSec = typeof item.duration === 'number' ? item.duration : undefined;
  const durationMs =
    typeof durationSec === 'number' && durationSec > 0 ? durationSec * 1000 : undefined;
  const coverUrl =
    (typeof item.album?.cover_medium === 'string' && item.album.cover_medium) ||
    (typeof item.album?.cover_big === 'string' && item.album.cover_big) ||
    (typeof item.album?.cover === 'string' && item.album.cover) ||
    undefined;

  return {
    id:
      typeof item.id === 'number' || typeof item.id === 'string'
        ? String(item.id)
        : `deezer-track-${index + 1}`,
    title,
    mainArtist,
    allArtists: artists.length > 0 ? artists : [mainArtist],
    durationMs,
    durationText: formatDurationText(durationSec),
    coverUrl,
    thumbnailUrl: coverUrl,
    albumName:
      typeof item.album?.title === 'string' && item.album.title
        ? item.album.title
        : undefined,
  };
}

/**
 * Extractor de playlists públicas de Deezer.
 *
 * Usa la API pública (`https://api.deezer.com/playlist/{id}`), que no requiere
 * token, y recorre la URL de paginación `tracks.next` hasta agotar las canciones.
 * Los enlaces cortos `deezer.page.link` se resuelven siguiendo la redirección.
 */
export class DeezerExtractor implements PlaylistExtractor {
  readonly platform = 'deezer' as const;

  canHandle(url: string): boolean {
    return this.extractPlaylistId(url) !== null || this.isShareLink(url);
  }

  extractPlaylistId(url: string): string | null {
    const parsed = this.parseUrl(url);
    if (!parsed) return null;

    const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
    if (host !== 'deezer.com' && host !== 'm.deezer.com' && host !== 'link.deezer.com') {
      return null;
    }

    const match = parsed.pathname.match(PLAYLIST_PATH_PATTERN);
    return match ? match[1] : null;
  }

  async extract(url: string): Promise<ExtractorResult> {
    let playlistId = this.extractPlaylistId(url);

    // Enlaces cortos de la app/web móvil (deezer.page.link): hay que seguir la
    // redirección para descubrir la URL real de la playlist.
    if (!playlistId && this.isShareLink(url)) {
      playlistId = await this.resolveShareLink(url);
    }

    if (!playlistId) {
      throw new Error(
        'URL de Deezer inválida. Acepta enlaces como https://www.deezer.com/playlist/{id} o enlaces cortos deezer.page.link.'
      );
    }

    return this.fetchPlaylist(playlistId);
  }

  /**
   * Normaliza URLs con o sin esquema ("deezer.com/playlist/123").
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

  private isShareLink(url: string): boolean {
    const parsed = this.parseUrl(url);
    if (!parsed) return false;

    const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
    return host === 'deezer.page.link' || host === 'link.deezer.com';
  }

  /**
   * Sigue el enlace corto y devuelve el id de playlist de la URL final.
   */
  private async resolveShareLink(url: string): Promise<string> {
    const parsed = this.parseUrl(url);
    const target = parsed ? parsed.toString() : url.trim();

    let response: any;
    try {
      response = await fetch(target, { headers: DEEZER_HEADERS, redirect: 'follow' });
    } catch (err: any) {
      throw err instanceof Error ? err : new Error(String(err));
    }

    const finalUrl: string =
      (typeof response?.url === 'string' && response.url) ||
      (typeof response?.headers?.get === 'function' ? response.headers.get('location') : '') ||
      '';

    const resolvedId = finalUrl ? this.extractPlaylistId(finalUrl) : null;
    if (resolvedId) return resolvedId;

    // Algunos enlaces cortos exponen el destino solo en el cuerpo de la página.
    if (response?.ok && typeof response.text === 'function') {
      const body = await response.text().catch(() => '');
      const bodyMatch =
        typeof body === 'string'
          ? body.match(/deezer\.com\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?playlist\/(\d+)/i)
          : null;
      if (bodyMatch) return bodyMatch[1];
    }

    throw new Error(
      'No se pudo resolver el enlace corto de Deezer. Copia el enlace completo de la playlist desde Deezer (https://www.deezer.com/playlist/{id}).'
    );
  }

  /**
   * Descarga la playlist y todas sus páginas de canciones.
   */
  private async fetchPlaylist(playlistId: string): Promise<ExtractorResult> {
    const firstResponse = await fetch(`${API_BASE_URL}/playlist/${playlistId}`, {
      headers: DEEZER_HEADERS,
    });

    if (!firstResponse.ok) {
      throw new Error(this.describeHttpError(firstResponse.status, playlistId));
    }

    const playlist = await firstResponse.json();
    if (playlist?.error) {
      throw this.describeApiError(playlist.error, playlistId);
    }

    if (playlist?.public === false) {
      throw new Error(
        `La playlist de Deezer es privada y no está disponible públicamente (id: ${playlistId}).`
      );
    }

    const tracks: ExtractedTrack[] = [];
    const seenIds = new Set<string>();

    this.collectTracks(playlist?.tracks?.data, tracks, seenIds);

    let nextUrl: string | null =
      typeof playlist?.tracks?.next === 'string' && playlist.tracks.next
        ? playlist.tracks.next
        : null;

    // Algunas respuestas antiguas no incluyen `tracks.data` pero sí `tracklist`.
    if (tracks.length === 0 && nextUrl === null && typeof playlist?.tracklist === 'string') {
      nextUrl = playlist.tracklist;
    }

    const visitedUrls = new Set<string>();
    let page = 1;

    while (nextUrl && page < MAX_PAGES && tracks.length < MAX_TRACKS) {
      if (visitedUrls.has(nextUrl)) break;
      visitedUrls.add(nextUrl);

      const pageResponse = await fetch(nextUrl, { headers: DEEZER_HEADERS });
      if (!pageResponse.ok) break;

      const pageData = await pageResponse.json();
      if (pageData?.error) break;

      const countBefore = tracks.length;
      this.collectTracks(pageData?.data, tracks, seenIds);

      const nextPage =
        typeof pageData?.next === 'string' && pageData.next ? pageData.next : null;
      if (tracks.length === countBefore || !nextPage || nextPage === nextUrl) break;

      nextUrl = nextPage;
      page++;
    }

    if (tracks.length === 0) {
      throw new Error(
        `La playlist de Deezer existe pero no contiene canciones reproducibles (id: ${playlistId}).`
      );
    }

    return {
      platform: 'deezer',
      playlistId,
      playlistTitle:
        typeof playlist?.title === 'string' && playlist.title.trim()
          ? playlist.title.trim()
          : 'Playlist de Deezer',
      totalTracks: tracks.length,
      tracks,
    };
  }

  private collectTracks(
    items: any,
    tracks: ExtractedTrack[],
    seenIds: Set<string>
  ): void {
    if (!Array.isArray(items)) return;

    for (const item of items) {
      if (tracks.length >= MAX_TRACKS) return;

      const track = mapDeezerTrack(item, tracks.length);
      if (!track || seenIds.has(track.id)) continue;

      seenIds.add(track.id);
      tracks.push(track);
    }
  }

  /**
   * La API de Deezer suele devolver HTTP 200 con un objeto `error` en el cuerpo:
   * 800 = no data (inexistente/privada), 700 = permiso denegado, 4 = cuota.
   */
  private describeApiError(error: any, playlistId: string): Error {
    const code = Number(error?.code);
    const message = typeof error?.message === 'string' ? error.message.trim() : '';

    if (code === 800 || /no data|not[ _-]?found|no encontrad/i.test(message)) {
      return new Error(
        `La playlist de Deezer no existe, fue eliminada o es privada (id: ${playlistId}).`
      );
    }
    if (code === 700 || /permission|denied|private|privad|forbidden/i.test(message)) {
      return new Error(
        `La playlist de Deezer es privada o no está disponible públicamente (id: ${playlistId}).`
      );
    }
    if (code === 4 || /quota|limit/i.test(message)) {
      return new Error(
        'Deezer alcanzó su límite de peticiones. Intenta de nuevo en unos minutos.'
      );
    }

    return new Error(
      `Deezer devolvió un error al consultar la playlist (id: ${playlistId})${message ? `: ${message}` : '.'}`
    );
  }

  private describeHttpError(status: number, playlistId: string): string {
    if (status === 404) {
      return `La playlist de Deezer no existe o el enlace es inválido (id: ${playlistId}, HTTP 404).`;
    }
    if (status === 401 || status === 403) {
      return `La playlist de Deezer es privada o no está disponible (id: ${playlistId}, HTTP ${status}).`;
    }
    if (status === 429) {
      return 'Error HTTP 429 de Deezer: se superó el límite de peticiones. Intenta de nuevo en unos minutos.';
    }
    return `Error HTTP ${status} al consultar la playlist de Deezer (id: ${playlistId}).`;
  }
}

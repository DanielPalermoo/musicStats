import { ExtractedTrack, ExtractorResult, PlaylistExtractor } from '@/types/playlist';

const TIDAL_API_BASE = 'https://api.tidal.com/v1';
const TIDAL_DEFAULT_TOKEN = 'CzET4vdadNUFQ5JU';
const DEFAULT_COUNTRY_CODE = 'US';
const MAX_PAGES = 30; // Hasta 3000 tracks
const PAGE_SIZE = 100;

const TIDAL_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'x-tidal-token': TIDAL_DEFAULT_TOKEN,
};

const TIDAL_PLAYLIST_PATTERN =
  /(?:tidal\.com\/(?:browse\/)?playlist\/|listen\.tidal\.com\/playlist\/)([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/;

function formatDurationText(durationSec?: number): string | undefined {
  if (typeof durationSec !== 'number' || !Number.isFinite(durationSec) || durationSec <= 0) {
    return undefined;
  }
  const total = Math.round(durationSec);
  const seconds = total % 60;
  const minutes = Math.floor(total / 60) % 60;
  const hours = Math.floor(total / 3600);
  const ss = String(seconds).padStart(2, '0');
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${ss}`;
  }
  return `${minutes}:${ss}`;
}

function buildCoverUrl(coverHash?: string | null): string | undefined {
  if (!coverHash || typeof coverHash !== 'string') return undefined;
  const path = coverHash.replace(/-/g, '/');
  return `https://resources.tidal.com/images/${path}/640x640.jpg`;
}

export class TidalExtractor implements PlaylistExtractor {
  readonly platform = 'tidal';

  canHandle(url: string): boolean {
    if (!url || typeof url !== 'string') return false;
    return TIDAL_PLAYLIST_PATTERN.test(url.trim());
  }

  extractPlaylistId(url: string): string | null {
    if (!url || typeof url !== 'string') return null;
    const match = url.trim().match(TIDAL_PLAYLIST_PATTERN);
    return match ? match[1] : null;
  }

  async extract(url: string): Promise<ExtractorResult> {
    const playlistId = this.extractPlaylistId(url);
    if (!playlistId) {
      throw new Error('La URL proporcionada no corresponde a una playlist válida de Tidal.');
    }

    // 1. Obtener información de la playlist
    const metaUrl = `${TIDAL_API_BASE}/playlists/${playlistId}?countryCode=${DEFAULT_COUNTRY_CODE}`;
    const metaRes = await fetch(metaUrl, { headers: TIDAL_HEADERS });
    if (!metaRes.ok) {
      if (metaRes.status === 404) {
        throw new Error('La playlist de Tidal no fue encontrada o es privada.');
      }
      throw new Error(`Error ${metaRes.status} al consultar la playlist de Tidal.`);
    }

    const metaData = await metaRes.json();
    const playlistTitle = metaData.title?.trim() || 'Playlist de Tidal';
    const totalTracks = typeof metaData.numberOfTracks === 'number' ? metaData.numberOfTracks : 0;

    // 2. Obtener los tracks de forma paginada
    const tracks: ExtractedTrack[] = [];
    let offset = 0;
    let page = 0;

    while (page < MAX_PAGES) {
      page++;
      const itemsUrl = `${TIDAL_API_BASE}/playlists/${playlistId}/items?countryCode=${DEFAULT_COUNTRY_CODE}&offset=${offset}&limit=${PAGE_SIZE}`;
      const itemsRes = await fetch(itemsUrl, { headers: TIDAL_HEADERS });

      if (!itemsRes.ok) {
        if (tracks.length > 0) break; // Si ya obtuvimos parte, no fallar
        throw new Error(`Error ${itemsRes.status} al obtener las canciones de Tidal.`);
      }

      const itemsData = await itemsRes.json();
      const items = Array.isArray(itemsData.items) ? itemsData.items : [];
      if (items.length === 0) break;

      for (const entry of items) {
        const item = entry?.item;
        if (!item) continue;

        const title = item.title?.trim() || '';
        if (!title) continue;

        const artists: string[] = [];
        if (Array.isArray(item.artists)) {
          for (const a of item.artists) {
            const name = a?.name?.trim();
            if (name && !artists.includes(name)) artists.push(name);
          }
        }
        if (artists.length === 0 && item.artist?.name) {
          artists.push(item.artist.name.trim());
        }

        const mainArtist = artists[0] || 'Artista Desconocido';
        const durationSec = typeof item.duration === 'number' ? item.duration : undefined;
        const durationMs = durationSec ? durationSec * 1000 : undefined;
        const coverUrl = buildCoverUrl(item.album?.cover);
        const albumName = item.album?.title?.trim() || undefined;

        tracks.push({
          id: String(item.id || `tidal-${tracks.length + 1}`),
          title,
          mainArtist,
          allArtists: artists.length > 0 ? artists : [mainArtist],
          durationMs,
          durationText: formatDurationText(durationSec),
          coverUrl,
          thumbnailUrl: coverUrl,
          albumName,
        });
      }

      offset += items.length;
      if (offset >= (itemsData.totalNumberOfItems ?? totalTracks) || items.length < PAGE_SIZE) {
        break;
      }
    }

    return {
      platform: 'tidal',
      playlistId,
      playlistTitle,
      totalTracks: tracks.length,
      tracks,
    };
  }
}

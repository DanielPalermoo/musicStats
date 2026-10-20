import { ExtractedTrack, ExtractorResult, PlaylistExtractor } from '@/types/playlist';

const YT_MUSIC_CLIENT_CONTEXT = {
  client: {
    clientName: 'WEB_REMIX',
    clientVersion: '1.20250219.01.00',
    hl: 'es',
    gl: 'US',
  },
};

const YT_WEB_CLIENT_CONTEXT = {
  client: {
    clientName: 'WEB',
    clientVersion: '2.20250219.00.00',
    hl: 'es',
    gl: 'US',
  },
};

const COMMON_HEADERS = {
  'Content-Type': 'application/json',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
  'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
};

const MAX_PAGES = 30; // Hasta ~3000 canciones de seguridad

/**
 * Limpia el sufijo "- Topic" o "VEVO" común en canales automáticos de YouTube/YouTube Music
 */
function cleanArtistName(name: string): string {
  return name
    .replace(/\s*-\s*Topic$/i, '')
    .replace(/VEVO$/i, '')
    .trim();
}

/**
 * Extrae artistas adicionales si en un mismo bloque vienen separados por ",", "&" o " y "
 */
function splitArtistString(raw: string): string[] {
  const cleaned = cleanArtistName(raw);
  if (!cleaned) return [];
  return cleaned
    .split(/\s*(?:,|&|\bfeat\.?\b|\bft\.?\b)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

export class YouTubeMusicExtractor implements PlaylistExtractor {
  readonly platform = 'youtube_music' as const;

  canHandle(url: string): boolean {
    return this.extractPlaylistId(url) !== null;
  }

  extractPlaylistId(url: string): string | null {
    try {
      const parsed = new URL(url.trim());
      const host = parsed.hostname.toLowerCase();
      const isYouTubeHost =
        host === 'music.youtube.com' ||
        host === 'www.youtube.com' ||
        host === 'youtube.com' ||
        host === 'm.youtube.com' ||
        host === 'youtu.be';

      if (!isYouTubeHost) return null;

      const listParam = parsed.searchParams.get('list');
      if (listParam && listParam.trim().length > 0) {
        return listParam.trim().replace(/^VL/, '');
      }

      // En caso de URL tipo music.youtube.com/browse/VLPL...
      const browseMatch = parsed.pathname.match(/\/browse\/(VL[A-Za-z0-9_-]+|[A-Za-z0-9_-]+)/);
      if (browseMatch) {
        return browseMatch[1].replace(/^VL/, '');
      }

      return null;
    } catch {
      return null;
    }
  }

  async extract(url: string): Promise<ExtractorResult> {
    const playlistId = this.extractPlaylistId(url);
    if (!playlistId) {
      throw new Error(
        'URL de YouTube Music inválida. Asegúrate de que incluya el parámetro "?list=..." de una playlist.'
      );
    }

    // Intentamos primero con el endpoint de YouTube Web InnerTube (más consistente en paginación de playlists grandes)
    // y enriquecemos/respaldamos con YouTube Music InnerTube (WEB_REMIX)
    const webResult = await this.extractViaYouTubeWeb(playlistId);
    if (webResult.tracks.length > 0) {
      return webResult;
    }

    const remixResult = await this.extractViaYouTubeMusicRemix(playlistId);
    if (remixResult.tracks.length > 0) {
      return remixResult;
    }

    throw new Error(
      'No se encontraron canciones en la playlist. Verifica que la playlist sea pública y que el enlace sea correcto.'
    );
  }

  /**
   * Extrae usando el cliente WEB de InnerTube (soporta paginación completa de miles de canciones en bloques de 100)
   */
  private async extractViaYouTubeWeb(playlistId: string): Promise<ExtractorResult> {
    const browseId = playlistId.startsWith('VL') ? playlistId : `VL${playlistId}`;
    const endpoint = 'https://www.youtube.com/youtubei/v1/browse?prettyPrint=false';

    const initialRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        ...COMMON_HEADERS,
        Origin: 'https://www.youtube.com',
        Referer: `https://www.youtube.com/playlist?list=${playlistId}`,
      },
      body: JSON.stringify({
        context: YT_WEB_CLIENT_CONTEXT,
        browseId,
      }),
    });

    if (!initialRes.ok) {
      throw new Error(`Error HTTP ${initialRes.status} al consultar YouTube`);
    }

    const initialData = await initialRes.json();
    const playlistTitle = this.extractTitleFromWebData(initialData) || 'Playlist de YouTube Music';

    const tracks: ExtractedTrack[] = [];
    const seenIds = new Set<string>();

    this.collectWebTracks(initialData, tracks, seenIds);
    let continuationToken = this.findContinuationToken(initialData);

    let page = 1;
    while (continuationToken && page < MAX_PAGES) {
      page++;
      const contRes = await fetch(endpoint, {
        method: 'POST',
        headers: {
          ...COMMON_HEADERS,
          Origin: 'https://www.youtube.com',
          Referer: `https://www.youtube.com/playlist?list=${playlistId}`,
        },
        body: JSON.stringify({
          context: YT_WEB_CLIENT_CONTEXT,
          continuation: continuationToken,
        }),
      });

      if (!contRes.ok) break;
      const contData = await contRes.json();

      const countBefore = tracks.length;
      this.collectWebTracks(contData, tracks, seenIds);
      const nextToken = this.findContinuationToken(contData);

      if (tracks.length === countBefore || nextToken === continuationToken) {
        break;
      }
      continuationToken = nextToken;
    }

    return {
      platform: 'youtube_music',
      playlistId,
      playlistTitle,
      totalTracks: tracks.length,
      tracks,
    };
  }

  /**
   * Extrae usando el cliente WEB_REMIX propio de music.youtube.com (útil para playlists exclusivas de YT Music como RDCLAK...)
   */
  private async extractViaYouTubeMusicRemix(playlistId: string): Promise<ExtractorResult> {
    const browseId = playlistId.startsWith('VL') ? playlistId : `VL${playlistId}`;
    const baseEndpoint = 'https://music.youtube.com/youtubei/v1/browse';

    const initialRes = await fetch(`${baseEndpoint}?prettyPrint=false`, {
      method: 'POST',
      headers: {
        ...COMMON_HEADERS,
        Origin: 'https://music.youtube.com',
        Referer: 'https://music.youtube.com/',
      },
      body: JSON.stringify({
        context: YT_MUSIC_CLIENT_CONTEXT,
        browseId,
      }),
    });

    if (!initialRes.ok) {
      throw new Error(`Error HTTP ${initialRes.status} al consultar YouTube Music`);
    }

    const initialData = await initialRes.json();
    const playlistTitle =
      this.extractTitleFromRemixData(initialData) || 'Playlist de YouTube Music';

    const tracks: ExtractedTrack[] = [];
    const seenIds = new Set<string>();

    this.collectRemixTracks(initialData, tracks, seenIds);
    let continuationToken = this.findContinuationToken(initialData);

    let page = 1;
    while (continuationToken && page < MAX_PAGES) {
      page++;
      const contUrl = `${baseEndpoint}?ctoken=${encodeURIComponent(
        continuationToken
      )}&continuation=${encodeURIComponent(continuationToken)}&type=next&prettyPrint=false`;

      const contRes = await fetch(contUrl, {
        method: 'POST',
        headers: {
          ...COMMON_HEADERS,
          Origin: 'https://music.youtube.com',
          Referer: 'https://music.youtube.com/',
        },
        body: JSON.stringify({
          context: YT_MUSIC_CLIENT_CONTEXT,
          continuation: continuationToken,
        }),
      });

      if (!contRes.ok) break;
      const contData = await contRes.json();

      const countBefore = tracks.length;
      this.collectRemixTracks(contData, tracks, seenIds);
      const nextToken = this.findContinuationToken(contData);

      if (tracks.length === countBefore || nextToken === continuationToken) {
        break;
      }
      continuationToken = nextToken;
    }

    return {
      platform: 'youtube_music',
      playlistId,
      playlistTitle,
      totalTracks: tracks.length,
      tracks,
    };
  }

  private extractTitleFromWebData(data: any): string | null {
    return (
      data?.metadata?.playlistMetadataRenderer?.title ||
      data?.header?.playlistHeaderRenderer?.title?.simpleText ||
      data?.header?.playlistHeaderRenderer?.title?.runs?.[0]?.text ||
      data?.header?.pageHeaderRenderer?.pageTitle ||
      null
    );
  }

  private extractTitleFromRemixData(data: any): string | null {
    return (
      data?.header?.musicDetailHeaderRenderer?.title?.runs?.[0]?.text ||
      data?.header?.musicEditablePlaylistDetailHeaderRenderer?.header?.musicDetailHeaderRenderer
        ?.title?.runs?.[0]?.text ||
      this. findResponsiveHeaderTitle(data) ||
      null
    );
  }

  private findResponsiveHeaderTitle(node: any): string | null {
    if (!node || typeof node !== 'object') return null;
    if (node.musicResponsiveHeaderRenderer?.title?.runs?.[0]?.text) {
      return node.musicResponsiveHeaderRenderer.title.runs[0].text;
    }
    for (const key of Object.keys(node)) {
      const found = this.findResponsiveHeaderTitle(node[key]);
      if (found) return found;
    }
    return null;
  }

  private collectWebTracks(
    node: any,
    tracks: ExtractedTrack[],
    seenIds: Set<string>
  ): void {
    if (!node || typeof node !== 'object') return;

    if (node.playlistVideoRenderer) {
      const renderer = node.playlistVideoRenderer;
      const videoId: string | undefined = renderer.videoId;
      const title: string =
        renderer.title?.runs?.map((r: any) => r.text).join('') ||
        renderer.title?.simpleText ||
        '';

      if (videoId && title && !seenIds.has(`${videoId}-${tracks.length}`)) {
        const bylineRuns: any[] = renderer.shortBylineText?.runs || [];
        const rawArtists: string[] = [];

        for (const run of bylineRuns) {
          if (run?.text) {
            for (const part of splitArtistString(run.text)) {
              if (!rawArtists.includes(part)) {
                rawArtists.push(part);
              }
            }
          }
        }

        const mainArtist = rawArtists[0] || 'Artista Desconocido';
        const allArtists = rawArtists.length > 0 ? rawArtists : [mainArtist];
        const thumbnails: any[] = renderer.thumbnail?.thumbnails || [];
        const thumbnailUrl =
          thumbnails.length > 0 ? thumbnails[thumbnails.length - 1]?.url : undefined;
        const durationText =
          renderer.lengthText?.simpleText ||
          renderer.lengthText?.runs?.[0]?.text ||
          undefined;

        tracks.push({
          id: videoId,
          title: title.trim(),
          mainArtist,
          allArtists,
          thumbnailUrl,
          durationText,
        });
      }
      return;
    }

    if (Array.isArray(node)) {
      for (const item of node) {
        this.collectWebTracks(item, tracks, seenIds);
      }
      return;
    }

    for (const key of Object.keys(node)) {
      this.collectWebTracks(node[key], tracks, seenIds);
    }
  }

  private collectRemixTracks(
    node: any,
    tracks: ExtractedTrack[],
    seenIds: Set<string>
  ): void {
    if (!node || typeof node !== 'object') return;

    if (node.musicResponsiveListItemRenderer) {
      const renderer = node.musicResponsiveListItemRenderer;
      const videoId: string | undefined =
        renderer.playlistItemData?.videoId ||
        renderer.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]
          ?.navigationEndpoint?.watchEndpoint?.videoId;

      const titleRuns: any[] =
        renderer.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
      const title = titleRuns.map((r) => r.text).join('').trim();

      if (title) {
        const secondColRuns: any[] =
          renderer.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];

        const artists: string[] = [];
        for (const run of secondColRuns) {
          const text = (run?.text || '').trim();
          if (!text || text === '•' || text === ' • ' || text === ',' || text === ' & ') {
            continue;
          }
          const pageType =
            run?.navigationEndpoint?.browseEndpoint?.browseEndpointContextSupportedConfigs
              ?.browseEndpointContextMusicConfig?.pageType;

          if (
            pageType === 'MUSIC_PAGE_TYPE_ARTIST' ||
            pageType === 'MUSIC_PAGE_TYPE_USER_CHANNEL'
          ) {
            const clean = cleanArtistName(text);
            if (clean && !artists.includes(clean)) {
              artists.push(clean);
            }
          }
        }

        // Si ningún run tenía pageType de artista, tomamos el primer bloque antes del separador "•"
        if (artists.length === 0 && secondColRuns.length > 0) {
          for (const run of secondColRuns) {
            const text = (run?.text || '').trim();
            if (text.includes('•')) break;
            for (const part of splitArtistString(text)) {
              if (part && !artists.includes(part)) {
                artists.push(part);
              }
            }
          }
        }

        const mainArtist = artists[0] || 'Artista Desconocido';
        const allArtists = artists.length > 0 ? artists : [mainArtist];
        const thumbnails: any[] =
          renderer.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails || [];
        const thumbnailUrl =
          thumbnails.length > 0 ? thumbnails[thumbnails.length - 1]?.url : undefined;
        const durationText =
          renderer.fixedColumns?.[0]?.musicResponsiveListItemFixedColumnRenderer?.text?.runs?.[0]
            ?.text || undefined;

        tracks.push({
          id: videoId || `ytm-${tracks.length + 1}`,
          title,
          mainArtist,
          allArtists,
          thumbnailUrl,
          durationText,
        });
      }
      return;
    }

    if (Array.isArray(node)) {
      for (const item of node) {
        this.collectRemixTracks(item, tracks, seenIds);
      }
      return;
    }

    for (const key of Object.keys(node)) {
      this.collectRemixTracks(node[key], tracks, seenIds);
    }
  }

  /**
   * Busca recursivamente el token de continuación para la siguiente página de resultados
   */
  private findContinuationToken(node: any): string | null {
    if (!node || typeof node !== 'object') return null;

    // Caso 1: continuationItemRenderer -> continuationEndpoint -> continuationCommand -> token
    if (node.continuationItemRenderer) {
      const endpoint = node.continuationItemRenderer.continuationEndpoint;
      if (endpoint?.continuationCommand?.token) {
        return endpoint.continuationCommand.token;
      }
      const commands: any[] = endpoint?.commandExecutorCommand?.commands || [];
      for (const cmd of commands) {
        if (cmd?.continuationCommand?.token) {
          return cmd.continuationCommand.token;
        }
      }
    }

    // Caso 2: nextContinuationData -> continuation
    if (node.nextContinuationData?.continuation) {
      return node.nextContinuationData.continuation;
    }

    // Caso 3: reloadContinuationData -> continuation (solo dentro de continuations de playlist)
    if (Array.isArray(node.continuations)) {
      for (const c of node.continuations) {
        if (c?.nextContinuationData?.continuation) {
          return c.nextContinuationData.continuation;
        }
      }
    }

    if (Array.isArray(node)) {
      for (let i = node.length - 1; i >= 0; i--) {
        const found = this.findContinuationToken(node[i]);
        if (found) return found;
      }
      return null;
    }

    for (const key of Object.keys(node)) {
      // Evitamos buscar tokens dentro de menús o popups irrelevantes
      if (key === 'menu' || key === 'header' || key === 'topbar') continue;
      const found = this.findContinuationToken(node[key]);
      if (found) return found;
    }

    return null;
  }
}

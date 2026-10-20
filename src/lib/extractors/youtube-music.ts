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

const MAX_PAGES = 30; // Hasta ~3000 canciones de seguridad (páginas de ~100)
const MAX_TRACKS = 5000; // Límite duro de seguridad contra respuestas malformadas

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
    const trimmed = url.trim();
    if (!trimmed) return null;

    // URL con esquema o pegada sin esquema ("music.youtube.com/playlist?list=...").
    // URLSearchParams ignora por diseño parámetros de tracking (&si=, &feature=shared, #fragment).
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
      const isYouTubeHost =
        host === 'music.youtube.com' ||
        host === 'www.youtube.com' ||
        host === 'youtube.com' ||
        host === 'm.youtube.com' ||
        host === 'youtu.be';
      if (!isYouTubeHost) continue;

      const listParam = parsed.searchParams.get('list');
      if (listParam && listParam.trim().length > 0) {
        return listParam.trim().replace(/^VL/, '');
      }

      // En caso de URL tipo music.youtube.com/browse/VLPL...
      const browseMatch = parsed.pathname.match(/\/browse\/(VL[A-Za-z0-9_-]+|[A-Za-z0-9_-]+)/);
      if (browseMatch) {
        return browseMatch[1].replace(/^VL/, '');
      }
    }

    return null;
  }

  async extract(url: string): Promise<ExtractorResult> {
    const playlistId = this.extractPlaylistId(url);
    if (!playlistId) {
      throw new Error(
        'URL de YouTube Music inválida. Asegúrate de que incluya el parámetro "?list=..." de una playlist.'
      );
    }

    // Intentamos primero con el endpoint de YouTube Web InnerTube (más consistente en
    // paginación de playlists grandes) y, si falla o no encuentra nada, con el cliente
    // WEB_REMIX de YouTube Music. Así un error HTTP/privada en un cliente no aborta el otro.
    const errors: Error[] = [];

    try {
      const webResult = await this.extractViaYouTubeWeb(playlistId);
      if (webResult.tracks.length > 0) return webResult;
    } catch (err: any) {
      errors.push(err instanceof Error ? err : new Error(String(err)));
    }

    try {
      const remixResult = await this.extractViaYouTubeMusicRemix(playlistId);
      if (remixResult.tracks.length > 0) return remixResult;
    } catch (err: any) {
      errors.push(err instanceof Error ? err : new Error(String(err)));
    }

    throw this.describeExtractionFailure(playlistId, errors);
  }

  /**
   * Elige el error más descriptivo entre los intentos fallidos: primero causas
   * claras (privada/inexistente), luego errores de red, y por último un mensaje genérico.
   */
  private describeExtractionFailure(playlistId: string, errors: Error[]): Error {
    const notFound = errors.find((e) => /no existe|not found|404/i.test(e.message));
    if (notFound) return notFound;

    const privateError = errors.find((e) => /privada|private|403|requiere iniciar sesi/i.test(e.message));
    if (privateError) return privateError;

    const network = errors.find((e) =>
      /fetch failed|network|enotfound|econnrefused|econnreset|etimedout|eai_again|socket hang up|timed? ?out/i.test(
        e.message
      )
    );
    if (network) return network;

    if (errors.length > 0) return errors[0];

    return new Error(
      `No se encontraron canciones en la playlist (id: ${playlistId}). Verifica que la playlist sea pública y que el enlace sea correcto.`
    );
  }

  /**
   * Detecta en la respuesta de InnerTube señales de que la playlist no existe o
   * es privada (aunque la respuesta HTTP sea 200) y devuelve un error descriptivo,
   * o null si no hay indicios de fallo.
   */
  private detectPlaylistError(data: any, context: 'YouTube' | 'YouTube Music'): Error | null {
    if (!data || typeof data !== 'object') return null;

    const status: string = data.playabilityStatus?.status || '';
    const reason: string = data.playabilityStatus?.reason || '';
    const alertText =
      data.alerts?.[0]?.alertRenderer?.text?.simpleText ||
      data.alerts?.[0]?.alertRenderer?.text?.runs?.map((r: any) => r?.text).join('') ||
      '';
    const apiMessage: string = data.error?.message || '';

    const blob = `${status} ${reason} ${alertText} ${apiMessage}`.toLowerCase();

    if (/login_required|sign in|iniciar sesi/.test(blob)) {
      return new Error(
        `La playlist de ${context} es privada o requiere iniciar sesión para verse.`
      );
    }
    if (/private|privada|restricted/.test(blob)) {
      return new Error(`La playlist de ${context} es privada y no está disponible públicamente.`);
    }
    if (/not found|no existe|does not exist|unavailable|no disponible|deleted|eliminada/.test(blob)) {
      return new Error(`La playlist de ${context} no existe o el enlace es inválido.`);
    }
    if (status === 'UNPLAYABLE' || status === 'ERROR') {
      return new Error(
        `No se pudo cargar la playlist en ${context}${reason ? `: ${reason}` : '.'}`
      );
    }

    return null;
  }

  /** Errores HTTP descriptivos según el código devuelto por InnerTube. */
  private describeHttpError(status: number, context: 'YouTube' | 'YouTube Music'): Error {
    if (status === 404) {
      return new Error(`La playlist de ${context} no existe o el enlace es inválido (HTTP 404).`);
    }
    if (status === 401 || status === 403) {
      return new Error(`La playlist de ${context} es privada o no está disponible (HTTP ${status}).`);
    }
    if (status === 429) {
      return new Error(
        `Se superó el límite de peticiones a ${context} (HTTP 429). Intenta de nuevo en unos minutos.`
      );
    }
    return new Error(`Error HTTP ${status} al consultar ${context}.`);
  }

  /**
   * Extrae usando el cliente WEB de InnerTube (soporta paginación completa de miles de canciones en bloques de ~100)
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
      throw this.describeHttpError(initialRes.status, 'YouTube');
    }

    const initialData = await initialRes.json();
    const playlistTitle = this.extractTitleFromWebData(initialData) || 'Playlist de YouTube Music';

    const tracks: ExtractedTrack[] = [];
    const seenIds = new Set<string>();

    this.collectWebTracks(initialData, tracks, seenIds);

    // Respuesta 200 sin canciones: InnerTube suele entregar la causa (privada/inexistente)
    // en playabilityStatus/alerts aunque el HTTP sea 200.
    if (tracks.length === 0) {
      const detected = this.detectPlaylistError(initialData, 'YouTube');
      if (detected) throw detected;
    }

    const seenTokens = new Set<string>();
    let continuationToken = this.findContinuationToken(initialData);

    let page = 1;
    while (continuationToken && page < MAX_PAGES && tracks.length < MAX_TRACKS) {
      // Guarda anti-bucle: un token ya consultado significa que la paginación cicló.
      if (seenTokens.has(continuationToken)) break;
      seenTokens.add(continuationToken);

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
      if (tracks.length === countBefore || !nextToken || nextToken === continuationToken) {
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
      throw this.describeHttpError(initialRes.status, 'YouTube Music');
    }

    const initialData = await initialRes.json();
    const playlistTitle =
      this.extractTitleFromRemixData(initialData) || 'Playlist de YouTube Music';

    const tracks: ExtractedTrack[] = [];
    const seenIds = new Set<string>();

    this.collectRemixTracks(initialData, tracks, seenIds);

    // Respuesta 200 sin canciones: busca la causa (privada/inexistente) en el cuerpo.
    if (tracks.length === 0) {
      const detected = this.detectPlaylistError(initialData, 'YouTube Music');
      if (detected) throw detected;
    }

    const seenTokens = new Set<string>();
    let continuationToken = this.findContinuationToken(initialData);

    let page = 1;
    while (continuationToken && page < MAX_PAGES && tracks.length < MAX_TRACKS) {
      // Guarda anti-bucle: un token ya consultado significa que la paginación cicló.
      if (seenTokens.has(continuationToken)) break;
      seenTokens.add(continuationToken);

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
      if (tracks.length === countBefore || !nextToken || nextToken === continuationToken) {
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
      this.findResponsiveHeaderTitle(data) ||
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

      // Deduplica por videoId entre páginas y aplica el límite de seguridad.
      if (videoId && title && !seenIds.has(videoId) && tracks.length < MAX_TRACKS) {
        seenIds.add(videoId);

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

      // Deduplica por videoId entre páginas y aplica el límite de seguridad.
      // Las entradas sin videoId conservan el id secuencial (no se pueden deduplicar).
      if (videoId && seenIds.has(videoId)) return;
      if (tracks.length >= MAX_TRACKS) return;

      if (title) {
        if (videoId) seenIds.add(videoId);
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

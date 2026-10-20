import { afterEach, describe, expect, it, vi } from 'vitest';

import { YouTubeMusicExtractor } from '@/lib/extractors/youtube-music';

const PLAYLIST_ID = 'PLabc123DEF456ghi789';

// ---------------------------------------------------------------------------
// Helpers de mock de fetch
// ---------------------------------------------------------------------------

interface FetchCall {
  url: string;
  init?: any;
}

interface FetchRoute {
  match: string | RegExp;
  response?: any;
  reject?: Error;
}

function mockFetch(routes: FetchRoute[]) {
  const calls: FetchCall[] = [];
  const fetchMock = vi.fn(async (input: any, init?: any) => {
    const call: FetchCall = { url: String(input), init };
    calls.push(call);

    for (const route of routes) {
      const matched =
        typeof route.match === 'string'
          ? call.url.startsWith(route.match)
          : route.match.test(call.url);
      if (!matched) continue;

      if (route.reject) throw route.reject;
      return typeof route.response === 'function' ? route.response(call) : route.response;
    }

    throw new Error(`Fetch sin ruta configurada: ${call.url}`);
  });

  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, calls };
}

function jsonResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  };
}

function networkFailure(message = 'fetch failed') {
  const err = new TypeError(message);
  (err as any).code = 'ENOTFOUND';
  return err;
}

// ---------------------------------------------------------------------------
// Helpers de datos InnerTube simulados
// ---------------------------------------------------------------------------

function webVideo(videoId: string, title: string, artist?: string) {
  return {
    playlistVideoRenderer: {
      videoId,
      title: { runs: [{ text: title }] },
      ...(artist
        ? { shortBylineText: { runs: [{ text: artist }] } }
        : {}),
      lengthText: { simpleText: '3:30' },
      thumbnail: {
        thumbnails: [{ url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` }],
      },
    },
  };
}

function webContinuation(token: string) {
  return {
    continuationItemRenderer: {
      continuationEndpoint: { continuationCommand: { token } },
    },
  };
}

function webPlaylistPage(title: string | null, items: any[]) {
  const data: any = {
    contents: { sectionListRenderer: { contents: [{ itemSectionRenderer: { contents: items } }] } },
  };
  if (title) data.metadata = { playlistMetadataRenderer: { title } };
  return data;
}

function remixItem(videoId: string | undefined, title: string, artist = 'Artista A') {
  return {
    musicResponsiveListItemRenderer: {
      ...(videoId ? { playlistItemData: { videoId } } : {}),
      flexColumns: [
        {
          musicResponsiveListItemFlexColumnRenderer: {
            text: { runs: [{ text: title }] },
          },
        },
        {
          musicResponsiveListItemFlexColumnRenderer: {
            text: {
              runs: [
                {
                  text: artist,
                  navigationEndpoint: {
                    browseEndpoint: {
                      browseEndpointContextSupportedConfigs: {
                        browseEndpointContextMusicConfig: {
                          pageType: 'MUSIC_PAGE_TYPE_ARTIST',
                        },
                      },
                    },
                  },
                },
                { text: ' • ' },
                { text: 'Álbum' },
              ],
            },
          },
        },
      ],
      fixedColumns: [
        {
          musicResponsiveListItemFixedColumnRenderer: {
            text: { runs: [{ text: '4:10' }] },
          },
        },
      ],
      thumbnail: {
        musicThumbnailRenderer: {
          thumbnail: { thumbnails: [{ url: `https://i.ytimg.com/vi/${videoId}/hq.jpg` }] },
        },
      },
    },
  };
}

function remixPlaylistPage(title: string, items: any[], continuations: any[] = []) {
  return {
    header: { musicDetailHeaderRenderer: { title: { runs: [{ text: title }] } } },
    contents: { sectionListRenderer: { contents: [{ itemSectionRenderer: { contents: items } }] } },
    continuations,
  };
}

function unplayablePage(status: string, reason: string) {
  return { playabilityStatus: { status, reason } };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

const extractor = new YouTubeMusicExtractor();

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Parsing de URLs
// ---------------------------------------------------------------------------

describe('YouTubeMusicExtractor.extractPlaylistId', () => {
  it('extrae el parámetro list de music.youtube.com ignorando &si= y &feature=shared', () => {
    expect(
      extractor.extractPlaylistId(
        `https://music.youtube.com/playlist?list=${PLAYLIST_ID}&si=abc123XYZ`
      )
    ).toBe(PLAYLIST_ID);
    expect(
      extractor.extractPlaylistId(
        `https://music.youtube.com/playlist?list=${PLAYLIST_ID}&feature=shared`
      )
    ).toBe(PLAYLIST_ID);
    expect(
      extractor.extractPlaylistId(
        `https://music.youtube.com/watch?v=xyz&list=${PLAYLIST_ID}&index=1`
      )
    ).toBe(PLAYLIST_ID);
  });

  it('acepta URLs de youtube.com, m.youtube.com y sin esquema', () => {
    expect(
      extractor.extractPlaylistId(`https://www.youtube.com/playlist?list=${PLAYLIST_ID}`)
    ).toBe(PLAYLIST_ID);
    expect(
      extractor.extractPlaylistId(`https://m.youtube.com/playlist?list=${PLAYLIST_ID}`)
    ).toBe(PLAYLIST_ID);
    expect(
      extractor.extractPlaylistId(`music.youtube.com/playlist?list=${PLAYLIST_ID}&si=x`)
    ).toBe(PLAYLIST_ID);
  });

  it('quita el prefijo VL de los ids tipo browse', () => {
    expect(
      extractor.extractPlaylistId(`https://music.youtube.com/playlist?list=VL${PLAYLIST_ID}`)
    ).toBe(PLAYLIST_ID);
    expect(
      extractor.extractPlaylistId(`https://music.youtube.com/browse/VL${PLAYLIST_ID}`)
    ).toBe(PLAYLIST_ID);
  });

  it('rechaza URLs sin parámetro list o de hosts ajenos', () => {
    expect(extractor.extractPlaylistId('')).toBeNull();
    expect(extractor.extractPlaylistId('https://music.youtube.com/playlist')).toBeNull();
    expect(extractor.extractPlaylistId('https://example.com/playlist?list=PL123')).toBeNull();
    expect(extractor.extractPlaylistId('https://music.youtube.com/watch?v=abc')).toBeNull();
    expect(extractor.extractPlaylistId('esto no es una url')).toBeNull();
  });
});

describe('YouTubeMusicExtractor.canHandle', () => {
  it('reconoce playlists de YouTube/YouTube Music y rechaza el resto', () => {
    expect(
      extractor.canHandle(`https://music.youtube.com/playlist?list=${PLAYLIST_ID}&si=x`)
    ).toBe(true);
    expect(extractor.canHandle('https://example.com/playlist?list=PL123')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// extract: cliente WEB con paginación
// ---------------------------------------------------------------------------

describe('YouTubeMusicExtractor.extract (cliente WEB)', () => {
  it('pagina con tokens de continuación y deduplica canciones repetidas', async () => {
    const calls = mockFetch([
      {
        match: 'https://www.youtube.com/youtubei/v1/browse',
        response: (call: FetchCall) => {
          const body = JSON.parse(call.init.body);
          if (body.continuation === 'tok-1') {
            // Repite v2 (ya vista) y agrega v3; sin más continuación.
            return jsonResponse(
              webPlaylistPage(null, [webVideo('v2', 'Canción 2'), webVideo('v3', 'Canción 3')])
            );
          }
          return jsonResponse(
            webPlaylistPage('Mi Playlist YT', [
              webVideo('v1', 'Canción 1', 'Artista A - Topic'),
              webVideo('v2', 'Canción 2', 'Artista B VEVO'),
              webContinuation('tok-1'),
            ])
          );
        },
      },
    ]);

    const result = await extractor.extract(
      `https://music.youtube.com/playlist?list=${PLAYLIST_ID}&si=abc`
    );

    expect(result.platform).toBe('youtube_music');
    expect(result.playlistId).toBe(PLAYLIST_ID);
    expect(result.playlistTitle).toBe('Mi Playlist YT');
    expect(result.tracks.map((t) => t.id)).toEqual(['v1', 'v2', 'v3']);
    expect(result.totalTracks).toBe(3);

    // Limpieza de sufijos "- Topic" / "VEVO" en los artistas.
    expect(result.tracks[0].mainArtist).toBe('Artista A');
    expect(result.tracks[1].mainArtist).toBe('Artista B');
    expect(result.tracks[0].durationText).toBe('3:30');
    expect(result.tracks[0].thumbnailUrl).toBe('https://i.ytimg.com/vi/v1/hqdefault.jpg');

    expect(calls.fetchMock).toHaveBeenCalledTimes(2);
    const secondBody = JSON.parse(calls.calls[1].init.body);
    expect(secondBody.continuation).toBe('tok-1');
    expect(secondBody.browseId).toBeUndefined();
  });

  it('termina la paginación aunque los tokens de continuación se repitan en bucle', async () => {
    const calls = mockFetch([
      {
        match: 'https://www.youtube.com/youtubei/v1/browse',
        response: (call: FetchCall) => {
          const body = JSON.parse(call.init.body);
          if (body.continuation === 'tok-a') {
            return jsonResponse(
              webPlaylistPage(null, [webVideo('v2', 'Canción 2'), webContinuation('tok-b')])
            );
          }
          if (body.continuation === 'tok-b') {
            // Vuelve a ofrecer tok-a: el guard debe cortar el bucle.
            return jsonResponse(
              webPlaylistPage(null, [webVideo('v3', 'Canción 3'), webContinuation('tok-a')])
            );
          }
          return jsonResponse(
            webPlaylistPage('Playlist Ciclica', [
              webVideo('v1', 'Canción 1'),
              webContinuation('tok-a'),
            ])
          );
        },
      },
    ]);

    const result = await extractor.extract(`https://www.youtube.com/playlist?list=${PLAYLIST_ID}`);

    expect(result.tracks.map((t) => t.id)).toEqual(['v1', 'v2', 'v3']);
    // initial + tok-a + tok-b; tok-a no se vuelve a consultar.
    expect(calls.fetchMock).toHaveBeenCalledTimes(3);
  });

  it('usa "Artista Desconocido" cuando el video no trae artista', async () => {
    mockFetch([
      {
        match: 'https://www.youtube.com/youtubei/v1/browse',
        response: jsonResponse(webPlaylistPage('Sin Artista', [webVideo('v1', 'Canción 1')])),
      },
    ]);

    const result = await extractor.extract(`https://music.youtube.com/playlist?list=${PLAYLIST_ID}`);

    expect(result.tracks[0].mainArtist).toBe('Artista Desconocido');
    expect(result.tracks[0].allArtists).toEqual(['Artista Desconocido']);
  });
});

// ---------------------------------------------------------------------------
// extract: fallback a WEB_REMIX (YouTube Music)
// ---------------------------------------------------------------------------

describe('YouTubeMusicExtractor.extract (fallback WEB_REMIX)', () => {
  it('cae a WEB_REMIX cuando el cliente WEB responde 404', async () => {
    const calls = mockFetch([
      {
        match: 'https://www.youtube.com/youtubei/v1/browse',
        response: jsonResponse({ error: 'not found' }, 404),
      },
      {
        match: 'https://music.youtube.com/youtubei/v1/browse',
        response: jsonResponse(
          remixPlaylistPage('Playlist Solo YT Music', [
            remixItem('r1', 'Canción Remix', 'Artista YTM'),
          ])
        ),
      },
    ]);

    const result = await extractor.extract(`https://music.youtube.com/playlist?list=${PLAYLIST_ID}`);

    expect(result.playlistTitle).toBe('Playlist Solo YT Music');
    expect(result.tracks).toHaveLength(1);
    expect(result.tracks[0]).toMatchObject({
      id: 'r1',
      title: 'Canción Remix',
      mainArtist: 'Artista YTM',
      durationText: '4:10',
    });
    expect(result.tracks[0].thumbnailUrl).toBe('https://i.ytimg.com/vi/r1/hq.jpg');

    // La segunda llamada fue al host de YouTube Music.
    expect(calls.calls[1].url).toContain('music.youtube.com');
  });

  it('pagina el cliente WEB_REMIX con continuaciones y deduplica', async () => {
    const calls = mockFetch([
      {
        match: 'https://www.youtube.com/youtubei/v1/browse',
        response: jsonResponse({}, 500),
      },
      {
        match: 'https://music.youtube.com/youtubei/v1/browse',
        response: (call: FetchCall) => {
          if (call.url.includes('ctoken=')) {
            expect(decodeURIComponent(call.url)).toContain('rmix-1');
            return jsonResponse({
              contents: {
                sectionListRenderer: {
                  contents: [
                    {
                      itemSectionRenderer: {
                        contents: [
                          remixItem('m2', 'Canción 2'),
                          remixItem('m1', 'Canción 1'), // duplicada
                        ],
                      },
                    },
                  ],
                },
              },
            });
          }
          // El formato real de WEB_REMIX entrega el token en `continuations`.
          return jsonResponse(
            remixPlaylistPage('Playlist Remix Paginada', [remixItem('m1', 'Canción 1')], [
              { nextContinuationData: { continuation: 'rmix-1' } },
            ])
          );
        },
      },
    ]);

    const result = await extractor.extract(`https://music.youtube.com/playlist?list=${PLAYLIST_ID}`);

    expect(result.tracks.map((t) => t.id)).toEqual(['m1', 'm2']);
    expect(result.totalTracks).toBe(2);
    // 1 intento fallido con el cliente WEB (500) + inicial WEB_REMIX + continuación.
    expect(calls.fetchMock).toHaveBeenCalledTimes(3);
  });

  it('deduplica también los ítems sin videoId con id secuencial', async () => {
    mockFetch([
      {
        match: 'https://www.youtube.com/youtubei/v1/browse',
        response: jsonResponse({}, 500),
      },
      {
        match: 'https://music.youtube.com/youtubei/v1/browse',
        response: jsonResponse(
          remixPlaylistPage('Sin IDs', [
            remixItem(undefined, 'Entrada sin ID'),
            remixItem(undefined, 'Entrada sin ID'), // id secuencial distinto: no deduplicable
          ])
        ),
      },
    ]);

    const result = await extractor.extract(`https://music.youtube.com/playlist?list=${PLAYLIST_ID}`);

    expect(result.tracks.map((t) => t.id)).toEqual(['ytm-1', 'ytm-2']);
  });
});

// ---------------------------------------------------------------------------
// extract: errores descriptivos
// ---------------------------------------------------------------------------

describe('YouTubeMusicExtractor.extract (errores)', () => {
  it('describe una playlist privada detectada en el cuerpo de la respuesta (HTTP 200)', async () => {
    mockFetch([
      {
        match: 'https://www.youtube.com/youtubei/v1/browse',
        response: jsonResponse(unplayablePage('LOGIN_REQUIRED', 'Sign in to confirm your identity')),
      },
      {
        match: 'https://music.youtube.com/youtubei/v1/browse',
        response: jsonResponse(unplayablePage('LOGIN_REQUIRED', 'Please sign in')),
      },
    ]);

    const error = await extractor
      .extract(`https://music.youtube.com/playlist?list=${PLAYLIST_ID}`)
      .catch((err: Error) => err);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/privada|requiere iniciar sesión/i);
  });

  it('describe una playlist inexistente detectada en el cuerpo de la respuesta', async () => {
    mockFetch([
      {
        match: 'https://www.youtube.com/youtubei/v1/browse',
        response: jsonResponse(unplayablePage('UNPLAYABLE', 'The playlist does not exist.')),
      },
      {
        match: 'https://music.youtube.com/youtubei/v1/browse',
        response: jsonResponse(unplayablePage('UNPLAYABLE', 'The playlist does not exist.')),
      },
    ]);

    const error = await extractor
      .extract(`https://music.youtube.com/playlist?list=${PLAYLIST_ID}`)
      .catch((err: Error) => err);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/no existe|inválido/i);
  });

  it('elige el error más descriptivo cuando un cliente falla con 404 y el otro con 403', async () => {
    mockFetch([
      {
        match: 'https://www.youtube.com/youtubei/v1/browse',
        response: jsonResponse({}, 404),
      },
      {
        match: 'https://music.youtube.com/youtubei/v1/browse',
        response: jsonResponse({}, 403),
      },
    ]);

    const error = await extractor
      .extract(`https://music.youtube.com/playlist?list=${PLAYLIST_ID}`)
      .catch((err: Error) => err);

    expect(error).toBeInstanceOf(Error);
    // Prevalece la causa "no existe" (404) sobre la de privacidad (403).
    expect((error as Error).message).toMatch(/no existe.*HTTP 404|HTTP 404.*no existe/i);
  });

  it('propaga el error de red cuando ambos clientes fallan por conectividad', async () => {
    mockFetch([
      { match: 'https://www.youtube.com/youtubei/v1/browse', reject: networkFailure() },
      { match: 'https://music.youtube.com/youtubei/v1/browse', reject: networkFailure() },
    ]);

    await expect(
      extractor.extract(`https://music.youtube.com/playlist?list=${PLAYLIST_ID}`)
    ).rejects.toThrow(/fetch failed/);
  });

  it('reporta el límite de peticiones (HTTP 429) de ambos clientes', async () => {
    mockFetch([
      { match: 'https://www.youtube.com/youtubei/v1/browse', response: jsonResponse({}, 429) },
      { match: 'https://music.youtube.com/youtubei/v1/browse', response: jsonResponse({}, 429) },
    ]);

    const error = await extractor
      .extract(`https://music.youtube.com/playlist?list=${PLAYLIST_ID}`)
      .catch((err: Error) => err);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/HTTP 429/);
  });

  it('rechaza con mensaje claro cuando la URL no es válida', async () => {
    await expect(extractor.extract('https://example.com/playlist?list=PL123')).rejects.toThrow(
      /URL de YouTube Music inválida/
    );
  });
});

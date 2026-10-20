import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SpotifyExtractor } from '@/lib/extractors/spotify';

const PLAYLIST_ID = '4n8k7bRkObWIP4d8w7I39y';

const ORIGINAL_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const ORIGINAL_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

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

function htmlResponse(html: string, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      throw new Error('Respuesta HTML sin JSON');
    },
    text: async () => html,
  };
}

function networkFailure(message = 'fetch failed') {
  const err = new TypeError(message);
  (err as any).code = 'ENOTFOUND';
  return err;
}

// ---------------------------------------------------------------------------
// Helpers de datos simulados
// ---------------------------------------------------------------------------

function embedHtml(nextData: unknown): string {
  return (
    '<!DOCTYPE html><html><head><title>Spotify - Web Player</title></head><body>' +
    `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(nextData)}</script>` +
    '</body></html>'
  );
}

function embedTrack(id: string, title: string, subtitle = 'Artista A', duration = 222000) {
  return { entityType: 'track', uri: `spotify:track:${id}`, title, subtitle, duration };
}

function embedNextData(entity: Record<string, any>, extraState: Record<string, any> = {}) {
  return {
    props: {
      pageProps: {
        state: {
          data: { entity },
          ...extraState,
        },
      },
    },
  };
}

function apiPlaylistPage(
  items: any[],
  next: string | null = null,
  name = 'Playlist API'
) {
  return {
    name,
    tracks: { items, next },
  };
}

function apiTrackEntry(id: string, name: string, artists: string[] = ['Artista A']) {
  return {
    track: {
      id,
      uri: `spotify:track:${id}`,
      name,
      type: 'track',
      artists: artists.map((artistName) => ({ name: artistName })),
      duration_ms: 200000,
      album: { name: 'Álbum', images: [{ url: 'https://i.scdn.co/image/cover' }] },
    },
  };
}

function useSpotifyCredentials() {
  vi.stubEnv('SPOTIFY_CLIENT_ID', 'test-client-id');
  vi.stubEnv('SPOTIFY_CLIENT_SECRET', 'test-client-secret');
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

const extractor = new SpotifyExtractor();

beforeEach(() => {
  delete process.env.SPOTIFY_CLIENT_ID;
  delete process.env.SPOTIFY_CLIENT_SECRET;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();

  if (ORIGINAL_CLIENT_ID === undefined) delete process.env.SPOTIFY_CLIENT_ID;
  else process.env.SPOTIFY_CLIENT_ID = ORIGINAL_CLIENT_ID;
  if (ORIGINAL_CLIENT_SECRET === undefined) delete process.env.SPOTIFY_CLIENT_SECRET;
  else process.env.SPOTIFY_CLIENT_SECRET = ORIGINAL_CLIENT_SECRET;
});

// ---------------------------------------------------------------------------
// Parsing de URLs y URIs
// ---------------------------------------------------------------------------

describe('SpotifyExtractor.extractPlaylistId', () => {
  it('extrae el id de una URL estándar de playlist', () => {
    expect(extractor.extractPlaylistId(`https://open.spotify.com/playlist/${PLAYLIST_ID}`)).toBe(
      PLAYLIST_ID
    );
  });

  it('ignora los params de tracking (?si=) y los fragmentos', () => {
    expect(
      extractor.extractPlaylistId(
        `https://open.spotify.com/playlist/${PLAYLIST_ID}?si=abc123XYZ#reproductor`
      )
    ).toBe(PLAYLIST_ID);
    expect(
      extractor.extractPlaylistId(
        `https://open.spotify.com/playlist/${PLAYLIST_ID}?si=a&feature=shared&utm_source=link`
      )
    ).toBe(PLAYLIST_ID);
  });

  it('acepta rutas intl, embed y de usuario', () => {
    expect(
      extractor.extractPlaylistId(`https://open.spotify.com/intl-es/playlist/${PLAYLIST_ID}`)
    ).toBe(PLAYLIST_ID);
    expect(
      extractor.extractPlaylistId(`https://open.spotify.com/intl-pt-BR/playlist/${PLAYLIST_ID}`)
    ).toBe(PLAYLIST_ID);
    expect(
      extractor.extractPlaylistId(`https://open.spotify.com/embed/playlist/${PLAYLIST_ID}`)
    ).toBe(PLAYLIST_ID);
    expect(
      extractor.extractPlaylistId(`https://open.spotify.com/user/alguien/playlist/${PLAYLIST_ID}`)
    ).toBe(PLAYLIST_ID);
  });

  it('acepta URLs pegadas sin esquema', () => {
    expect(
      extractor.extractPlaylistId(`open.spotify.com/playlist/${PLAYLIST_ID}?si=abc123`)
    ).toBe(PLAYLIST_ID);
    expect(extractor.extractPlaylistId(`www.open.spotify.com/playlist/${PLAYLIST_ID}`)).toBe(
      PLAYLIST_ID
    );
  });

  it('acepta URIs de Spotify, incluidas la forma legada y sufijos de tracking', () => {
    expect(extractor.extractPlaylistId(`spotify:playlist:${PLAYLIST_ID}`)).toBe(PLAYLIST_ID);
    expect(extractor.extractPlaylistId(`spotify:playlist:${PLAYLIST_ID}?si=abc123`)).toBe(
      PLAYLIST_ID
    );
    expect(extractor.extractPlaylistId(`spotify:user:someone:playlist:${PLAYLIST_ID}`)).toBe(
      PLAYLIST_ID
    );
  });

  it('rechaza enlaces que no son playlists de Spotify', () => {
    expect(extractor.extractPlaylistId('')).toBeNull();
    expect(extractor.extractPlaylistId('   ')).toBeNull();
    expect(extractor.extractPlaylistId('https://example.com/playlist/abc')).toBeNull();
    expect(extractor.extractPlaylistId(`https://open.spotify.com/track/${PLAYLIST_ID}`)).toBeNull();
    expect(extractor.extractPlaylistId('https://open.spotify.com/playlist/corta')).toBeNull();
    expect(extractor.extractPlaylistId('spotify:track:4n8k7bRkObWIP4d8w7I39y')).toBeNull();
    expect(extractor.extractPlaylistId('esto no es una url')).toBeNull();
  });
});

describe('SpotifyExtractor.canHandle', () => {
  it('reconoce URLs y URIs de playlist y rechaza el resto', () => {
    expect(extractor.canHandle(`https://open.spotify.com/playlist/${PLAYLIST_ID}?si=x`)).toBe(true);
    expect(extractor.canHandle(`spotify:playlist:${PLAYLIST_ID}`)).toBe(true);
    expect(extractor.canHandle('https://example.com/playlist/abc')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// extract: Web API con credenciales (Client Credentials)
// ---------------------------------------------------------------------------

describe('SpotifyExtractor.extract (Web API con credenciales)', () => {
  it('obtiene token, pagina las canciones y deduplica ids repetidos', async () => {
    useSpotifyCredentials();

    mockFetch([
      {
        match: 'https://accounts.spotify.com/api/token',
        response: jsonResponse({ access_token: 'token-api', token_type: 'Bearer' }),
      },
      {
        match: `https://api.spotify.com/v1/playlists/${PLAYLIST_ID}/tracks`,
        // El endpoint de páginas de canciones devuelve {items, next} en la raíz.
        response: jsonResponse({
          items: [
            apiTrackEntry('t2', 'Canción 2', ['Artista B']),
            // Entrada repetida y entrada sin track (hueco) e episodio: se ignoran.
            apiTrackEntry('t1', 'Canción 1'),
            null,
            {
              track: {
                id: 'ep1',
                uri: 'spotify:episode:ep1',
                name: 'Episodio de podcast',
                type: 'episode',
                artists: [],
              },
            },
          ],
          next: null,
        }),
      },
      {
        match: `https://api.spotify.com/v1/playlists/${PLAYLIST_ID}`,
        response: jsonResponse(
          apiPlaylistPage(
            [
              apiTrackEntry('t1', 'Canción 1'),
              apiTrackEntry('t3', 'Canción 3', ['Artista C', 'Artista D']),
            ],
            `https://api.spotify.com/v1/playlists/${PLAYLIST_ID}/tracks?offset=100&limit=100`,
            'Mi Playlist Grande'
          )
        ),
      },
    ]);

    const result = await extractor.extract(`https://open.spotify.com/playlist/${PLAYLIST_ID}?si=x`);

    expect(result.platform).toBe('spotify');
    expect(result.playlistId).toBe(PLAYLIST_ID);
    expect(result.playlistTitle).toBe('Mi Playlist Grande');
    expect(result.tracks.map((t) => t.id)).toEqual(['t1', 't3', 't2']);
    expect(result.totalTracks).toBe(3);

    const third = result.tracks[2];
    expect(third.title).toBe('Canción 2');
    expect(third.mainArtist).toBe('Artista B');
    expect(third.durationText).toBe('3:20');
    expect(third.coverUrl).toBe('https://i.scdn.co/image/cover');

    const first = result.tracks[0];
    expect(first.allArtists).toEqual(['Artista A']);
    // El ítem multi-artista (t3) conserva el orden original.
    expect(result.tracks[1].allArtists).toEqual(['Artista C', 'Artista D']);
    expect(result.tracks[1].mainArtist).toBe('Artista C');
  });

  it('describe un playlist vacío devuelto por la Web API', async () => {
    useSpotifyCredentials();

    mockFetch([
      {
        match: 'https://accounts.spotify.com/api/token',
        response: jsonResponse({ access_token: 'token-api' }),
      },
      {
        match: `https://api.spotify.com/v1/playlists/${PLAYLIST_ID}`,
        response: jsonResponse(apiPlaylistPage([], null, 'Playlist Vacía')),
      },
      {
        match: 'https://open.spotify.com/embed/playlist',
        response: htmlResponse(
          embedHtml(embedNextData({ title: 'Playlist Vacía', trackList: [] }))
        ),
      },
    ]);

    await expect(extractor.extract(`spotify:playlist:${PLAYLIST_ID}`)).rejects.toThrow(
      /está vacía|no contiene canciones/
    );
  });

  it('combina el error 404 de la Web API con el detalle del fallback cuando ninguno extrae nada', async () => {
    useSpotifyCredentials();

    const htmlPage = htmlResponse('<html><head><title>Página</title></head><body></body></html>');

    mockFetch([
      {
        match: 'https://accounts.spotify.com/api/token',
        response: jsonResponse({ access_token: 'token-api' }),
      },
      {
        match: `https://api.spotify.com/v1/playlists/${PLAYLIST_ID}`,
        response: jsonResponse({ error: { status: 404, message: 'not found' } }, 404),
      },
      { match: 'https://open.spotify.com/embed/playlist', response: htmlPage },
      { match: 'https://open.spotify.com/playlist', response: htmlPage },
    ]);

    const error = await extractor
      .extract(`https://open.spotify.com/playlist/${PLAYLIST_ID}`)
      .catch((err: Error) => err);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/HTTP 404/i);
  });
});

// ---------------------------------------------------------------------------
// extract: fallback anónimo (embed + página pública)
// ---------------------------------------------------------------------------

describe('SpotifyExtractor.extract (fallback anónimo)', () => {
  it('mapea las canciones del __NEXT_DATA__ del embed y deduplica', async () => {
    mockFetch([
      {
        match: 'https://open.spotify.com/embed/playlist',
        response: htmlResponse(
          embedHtml(
            embedNextData({
              title: 'Playlist del Embed',
              trackList: [
                embedTrack('e1', 'Canción Embed 1', 'Artista A, Artista B'),
                embedTrack('e1', 'Canción Embed 1', 'Artista A, Artista B'),
                { ...embedTrack('e2', '  '), entityType: 'track' }, // sin título: se ignora
                { ...embedTrack('e3', 'Intro'), entityType: 'episode' }, // no es canción
                embedTrack('e4', 'Canción Embed 2', ''), // sin artistas
              ],
            })
          )
        ),
      },
    ]);

    const result = await extractor.extract(`open.spotify.com/playlist/${PLAYLIST_ID}?si=abc`);

    expect(result.playlistTitle).toBe('Playlist del Embed');
    expect(result.tracks.map((t) => t.id)).toEqual(['e1', 'e4']);
    expect(result.tracks[0].allArtists).toEqual(['Artista A', 'Artista B']);
    expect(result.tracks[0].durationText).toBe('3:42');
    expect(result.tracks[1].mainArtist).toBe('Artista Desconocido');
    expect(result.totalTracks).toBe(2);
  });

  it('usa el token anónimo del embed para consultar la Web API cuando está disponible', async () => {
    const calls = mockFetch([
      {
        match: 'https://open.spotify.com/embed/playlist',
        response: htmlResponse(
          embedHtml(
            embedNextData(
              { title: 'Playlist', trackList: [] },
              {
                settings: {
                  session: {
                    accessToken: 'anon-token',
                    accessTokenExpirationTimestampMs: Date.now() + 60 * 60 * 1000,
                  },
                },
              }
            )
          )
        ),
      },
      {
        match: `https://api.spotify.com/v1/playlists/${PLAYLIST_ID}`,
        response: jsonResponse(apiPlaylistPage([apiTrackEntry('a1', 'Vía Token Anónimo')], null, 'Playlist')),
      },
    ]);

    const result = await extractor.extract(`spotify:playlist:${PLAYLIST_ID}`);

    expect(result.tracks.map((t) => t.id)).toEqual(['a1']);

    const apiCall = calls.calls.find((c) => c.url.includes('api.spotify.com'));
    expect(apiCall?.init?.headers?.Authorization).toBe('Bearer anon-token');
  });

  it('extrae del initialState en base64 de la página pública cuando no hay __NEXT_DATA__', async () => {
    const state = {
      entities: {
        items: {
          [`spotify:playlist:${PLAYLIST_ID}`]: {
            name: 'Playlist Web',
            content: {
              items: [
                {
                  itemV2: {
                    data: {
                      name: 'Canción Web',
                      uri: 'spotify:track:w1',
                      artists: { items: [{ profile: { name: 'Artista Web' } }] },
                      duration: { totalMilliseconds: 185000 },
                      albumOfTrack: {
                        name: 'Álbum Web',
                        coverArt: { sources: [{ url: 'https://i.scdn.co/image/web' }] },
                      },
                    },
                  },
                },
              ],
            },
          },
        },
      },
    };
    const encoded = Buffer.from(JSON.stringify(state), 'utf8').toString('base64');
    const publicHtml =
      '<html><head><title>Canción Web | Spotify - Playlist</title></head><body>' +
      `<script id="initialState">${encoded}</script>` +
      '</body></html>';

    mockFetch([
      {
        match: 'https://open.spotify.com/embed/playlist',
        response: htmlResponse('<html><body>Sin datos</body></html>'),
      },
      { match: 'https://open.spotify.com/playlist', response: htmlResponse(publicHtml) },
    ]);

    const result = await extractor.extract(`https://open.spotify.com/playlist/${PLAYLIST_ID}`);

    expect(result.playlistTitle).toBe('Playlist Web');
    expect(result.tracks).toHaveLength(1);
    expect(result.tracks[0]).toMatchObject({
      id: 'w1',
      title: 'Canción Web',
      mainArtist: 'Artista Web',
      durationText: '3:05',
      albumName: 'Álbum Web',
    });
  });

  it('describe una playlist inexistente (404 en embed y página pública)', async () => {
    mockFetch([
      { match: 'https://open.spotify.com/embed/playlist', response: jsonResponse({}, 404) },
      { match: 'https://open.spotify.com/playlist', response: jsonResponse({}, 404) },
    ]);

    await expect(extractor.extract(`spotify:playlist:${PLAYLIST_ID}`)).rejects.toThrow(
      /no existe, fue eliminada o es privada/
    );
  });

  it('detecta una playlist privada por el status 401 embebido en el __NEXT_DATA__', async () => {
    mockFetch([
      {
        match: 'https://open.spotify.com/embed/playlist',
        response: htmlResponse(
          embedHtml({ props: { pageProps: { status: 401, entity: null } } })
        ),
      },
    ]);

    await expect(extractor.extract(`spotify:playlist:${PLAYLIST_ID}`)).rejects.toThrow(
      /es privada o no está disponible/
    );
  });

  it('propaga el error de red sin enmascarar cuando no hay credenciales', async () => {
    mockFetch([
      { match: 'https://open.spotify.com/embed/playlist', reject: networkFailure() },
      { match: 'https://open.spotify.com/playlist', reject: networkFailure() },
    ]);

    await expect(extractor.extract(`spotify:playlist:${PLAYLIST_ID}`)).rejects.toThrow(
      /fetch failed/
    );
  });

  it('propaga el error de red también cuando el token falla con credenciales', async () => {
    useSpotifyCredentials();

    mockFetch([
      { match: 'https://accounts.spotify.com/api/token', reject: networkFailure() },
      { match: 'https://open.spotify.com/embed/playlist', reject: networkFailure() },
      { match: 'https://open.spotify.com/playlist', reject: networkFailure() },
    ]);

    await expect(extractor.extract(`spotify:playlist:${PLAYLIST_ID}`)).rejects.toThrow(
      /fetch failed/
    );
  });

  it('rechaza con mensaje claro cuando la URL no es válida', async () => {
    await expect(extractor.extract('https://example.com/playlist/abc')).rejects.toThrow(
      /URL de Spotify inválida/
    );
  });
});

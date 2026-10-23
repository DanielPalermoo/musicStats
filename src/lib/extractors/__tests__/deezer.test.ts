import { afterEach, describe, expect, it, vi } from 'vitest';

import { DeezerExtractor } from '@/lib/extractors/deezer';

const PLAYLIST_ID = '3110429622';

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
    url: '',
    json: async () => data,
    text: async () => JSON.stringify(data),
  };
}

function redirectResponse(finalUrl: string) {
  return {
    ok: true,
    status: 200,
    url: finalUrl,
    json: async () => ({}),
    text: async () => '<html></html>',
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

function apiTrack(
  id: number,
  title: string,
  artist = 'Artista A',
  duration = 200,
  extra: Record<string, any> = {}
) {
  return {
    id,
    title,
    duration,
    artist: { id: id + 1000, name: artist },
    album: {
      id: id + 2000,
      title: 'Álbum',
      cover: 'https://e-cdns-images.dzcdn.net/cover/56.jpg',
      cover_medium: 'https://e-cdns-images.dzcdn.net/cover/250.jpg',
    },
    ...extra,
  };
}

function playlistPage(
  data: any[],
  next: string | null = null,
  title = 'Mi Playlist Deezer',
  extra: Record<string, any> = {}
) {
  return {
    id: Number(PLAYLIST_ID),
    title,
    public: true,
    nb_tracks: data.length,
    tracks: { data, next },
    ...extra,
  };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

const extractor = new DeezerExtractor();

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Parsing de URLs
// ---------------------------------------------------------------------------

describe('DeezerExtractor.extractPlaylistId', () => {
  it('extrae el id de una URL estándar y de rutas con idioma', () => {
    expect(extractor.extractPlaylistId(`https://www.deezer.com/playlist/${PLAYLIST_ID}`)).toBe(
      PLAYLIST_ID
    );
    expect(extractor.extractPlaylistId(`https://deezer.com/es/playlist/${PLAYLIST_ID}`)).toBe(
      PLAYLIST_ID
    );
    expect(
      extractor.extractPlaylistId(`https://www.deezer.com/en/playlist/${PLAYLIST_ID}/?utm=x`)
    ).toBe(PLAYLIST_ID);
  });

  it('acepta URLs sin esquema y el subdominio móvil', () => {
    expect(extractor.extractPlaylistId(`deezer.com/playlist/${PLAYLIST_ID}?deferredFl=1`)).toBe(
      PLAYLIST_ID
    );
    expect(extractor.extractPlaylistId(`m.deezer.com/playlist/${PLAYLIST_ID}`)).toBe(PLAYLIST_ID);
  });

  it('rechaza enlaces que no son playlists de Deezer', () => {
    expect(extractor.extractPlaylistId('')).toBeNull();
    expect(extractor.extractPlaylistId('   ')).toBeNull();
    expect(extractor.extractPlaylistId(`https://www.deezer.com/track/${PLAYLIST_ID}`)).toBeNull();
    expect(extractor.extractPlaylistId(`https://www.deezer.com/album/${PLAYLIST_ID}`)).toBeNull();
    expect(extractor.extractPlaylistId(`https://example.com/playlist/${PLAYLIST_ID}`)).toBeNull();
    expect(extractor.extractPlaylistId(`https://www.deezer.com/playlist/abc`)).toBeNull();
    expect(extractor.extractPlaylistId('esto no es una url')).toBeNull();
  });
});

describe('DeezerExtractor.canHandle', () => {
  it('reconoce playlists y enlaces cortos, y rechaza el resto', () => {
    expect(extractor.canHandle(`https://www.deezer.com/playlist/${PLAYLIST_ID}?utm=x`)).toBe(true);
    expect(extractor.canHandle('https://deezer.page.link/AbCdEf123')).toBe(true);
    expect(extractor.canHandle(`https://www.deezer.com/track/${PLAYLIST_ID}`)).toBe(false);
    expect(extractor.canHandle('https://example.com/playlist/123')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// extract: API pública con paginación
// ---------------------------------------------------------------------------

describe('DeezerExtractor.extract', () => {
  it('pagina las canciones, deduplica ids y mapea artistas y duración', async () => {
    const nextUrl = `https://api.deezer.com/playlist/${PLAYLIST_ID}/tracks?index=2`;

    mockFetch([
      {
        match: nextUrl,
        response: jsonResponse({
          data: [
            apiTrack(2, 'Canción 2', 'Artista B', 185),
            apiTrack(3, 'Canción 3', 'Artista C', 3725, {
              contributors: [{ name: 'Artista D' }],
            }),
          ],
          next: null,
        }),
      },
      {
        match: `https://api.deezer.com/playlist/${PLAYLIST_ID}`,
        response: jsonResponse(
          playlistPage(
            [
              apiTrack(1, 'Canción 1', 'Artista A', 200),
              apiTrack(2, 'Canción 2', 'Artista B', 185),
            ],
            nextUrl
          )
        ),
      },
    ]);

    const result = await extractor.extract(
      `https://www.deezer.com/es/playlist/${PLAYLIST_ID}?utm_source=share`
    );

    expect(result.platform).toBe('deezer');
    expect(result.playlistId).toBe(PLAYLIST_ID);
    expect(result.playlistTitle).toBe('Mi Playlist Deezer');
    expect(result.tracks.map((track) => track.id)).toEqual(['1', '2', '3']);
    expect(result.totalTracks).toBe(3);

    const first = result.tracks[0];
    expect(first.title).toBe('Canción 1');
    expect(first.mainArtist).toBe('Artista A');
    expect(first.allArtists).toEqual(['Artista A']);
    expect(first.durationText).toBe('3:20');
    expect(first.durationMs).toBe(200000);
    expect(first.coverUrl).toBe('https://e-cdns-images.dzcdn.net/cover/250.jpg');
    expect(first.albumName).toBe('Álbum');

    const third = result.tracks[2];
    expect(third.durationText).toBe('1:02:05');
    expect(third.allArtists).toEqual(['Artista C', 'Artista D']);
    expect(third.mainArtist).toBe('Artista C');
  });

  it('usa "Artista Desconocido" cuando la pista no trae artista', async () => {
    mockFetch([
      {
        match: `https://api.deezer.com/playlist/${PLAYLIST_ID}`,
        response: jsonResponse(
          playlistPage([
            {
              id: 9,
              title: 'Pista sin artista',
              duration: 120,
              album: { title: 'Álbum' },
            },
          ])
        ),
      },
    ]);

    const result = await extractor.extract(`deezer.com/playlist/${PLAYLIST_ID}`);

    expect(result.tracks[0].mainArtist).toBe('Artista Desconocido');
    expect(result.tracks[0].allArtists).toEqual(['Artista Desconocido']);
    expect(result.tracks[0].coverUrl).toBeUndefined();
  });

  it('resuelve un enlace corto deezer.page.link antes de consultar la API', async () => {
    const calls = mockFetch([
      {
        match: 'https://deezer.page.link/AbCdEf123',
        response: redirectResponse(`https://www.deezer.com/es/playlist/${PLAYLIST_ID}?deferredFl=1`),
      },
      {
        match: `https://api.deezer.com/playlist/${PLAYLIST_ID}`,
        response: jsonResponse(playlistPage([apiTrack(1, 'Canción corta')], null, 'Playlist Corta')),
      },
    ]);

    const result = await extractor.extract('https://deezer.page.link/AbCdEf123');

    expect(result.playlistTitle).toBe('Playlist Corta');
    expect(result.tracks.map((track) => track.id)).toEqual(['1']);
    expect(calls.calls[0].init.redirect).toBe('follow');
  });

  it('extrae el id del HTML cuando el enlace corto no expone la URL final', async () => {
    mockFetch([
      {
        match: 'https://deezer.page.link/AbCdEf123',
        response: {
          ok: true,
          status: 200,
          url: '',
          json: async () => ({}),
          text: async () =>
            `<html><a href="https://www.deezer.com/playlist/${PLAYLIST_ID}">Escuchar</a></html>`,
        },
      },
      {
        match: `https://api.deezer.com/playlist/${PLAYLIST_ID}`,
        response: jsonResponse(playlistPage([apiTrack(1, 'Canción')])),
      },
    ]);

    const result = await extractor.extract('https://deezer.page.link/AbCdEf123');
    expect(result.playlistId).toBe(PLAYLIST_ID);
  });
});

// ---------------------------------------------------------------------------
// extract: errores descriptivos
// ---------------------------------------------------------------------------

describe('DeezerExtractor.extract (errores)', () => {
  it('describe una playlist inexistente devuelta con HTTP 404', async () => {
    mockFetch([
      {
        match: `https://api.deezer.com/playlist/${PLAYLIST_ID}`,
        response: jsonResponse({ error: { code: 800, message: 'no data' } }, 404),
      },
    ]);

    await expect(
      extractor.extract(`https://www.deezer.com/playlist/${PLAYLIST_ID}`)
    ).rejects.toThrow(/no existe|inválido.*404|HTTP 404/i);
  });

  it('describe una playlist inexistente o privada devuelta con HTTP 200 y code 800', async () => {
    mockFetch([
      {
        match: `https://api.deezer.com/playlist/${PLAYLIST_ID}`,
        response: jsonResponse({
          error: { type: 'DataException', message: 'no data', code: 800 },
        }),
      },
    ]);

    await expect(
      extractor.extract(`https://www.deezer.com/playlist/${PLAYLIST_ID}`)
    ).rejects.toThrow(/no existe, fue eliminada o es privada/);
  });

  it('describe una playlist privada marcada con public=false', async () => {
    mockFetch([
      {
        match: `https://api.deezer.com/playlist/${PLAYLIST_ID}`,
        response: jsonResponse(playlistPage([apiTrack(1, 'Canción')], null, 'Privada', { public: false })),
      },
    ]);

    await expect(
      extractor.extract(`https://www.deezer.com/playlist/${PLAYLIST_ID}`)
    ).rejects.toThrow(/es privada/);
  });

  it('describe una playlist vacía', async () => {
    mockFetch([
      {
        match: `https://api.deezer.com/playlist/${PLAYLIST_ID}`,
        response: jsonResponse(playlistPage([], null, 'Vacía')),
      },
    ]);

    await expect(
      extractor.extract(`https://www.deezer.com/playlist/${PLAYLIST_ID}`)
    ).rejects.toThrow(/no contiene canciones/);
  });

  it('describe un error de cuota de la API', async () => {
    mockFetch([
      {
        match: `https://api.deezer.com/playlist/${PLAYLIST_ID}`,
        response: jsonResponse({ error: { code: 4, message: 'Quota limit exceeded' } }),
      },
    ]);

    await expect(
      extractor.extract(`https://www.deezer.com/playlist/${PLAYLIST_ID}`)
    ).rejects.toThrow(/límite de peticiones/);
  });

  it('propaga el error de red sin enmascarar', async () => {
    mockFetch([
      {
        match: `https://api.deezer.com/playlist/${PLAYLIST_ID}`,
        reject: networkFailure(),
      },
    ]);

    await expect(
      extractor.extract(`https://www.deezer.com/playlist/${PLAYLIST_ID}`)
    ).rejects.toThrow(/fetch failed/);
  });

  it('falla con un mensaje claro cuando el enlace corto no se puede resolver', async () => {
    mockFetch([
      {
        match: 'https://deezer.page.link/AbCdEf123',
        response: jsonResponse({}),
      },
    ]);

    await expect(extractor.extract('https://deezer.page.link/AbCdEf123')).rejects.toThrow(
      /No se pudo resolver el enlace corto/
    );
  });

  it('rechaza con mensaje claro cuando la URL no es válida', async () => {
    await expect(extractor.extract('https://example.com/playlist/123')).rejects.toThrow(
      /URL de Deezer inválida/
    );
  });
});

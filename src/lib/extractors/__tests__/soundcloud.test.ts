import { afterEach, describe, expect, it, vi } from 'vitest';

import { SoundCloudExtractor } from '@/lib/extractors/soundcloud';

const SET_ID = 'djprueba/sets/mi-set';

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

function htmlResponse(html: string, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    url: '',
    json: async () => {
      throw new Error('Respuesta HTML sin JSON');
    },
    text: async () => html,
  };
}

/** Las fábricas permiten construir la respuesta en cada llamada (evita `json()` repetidos). */
function json(data: unknown, status = 200) {
  return () => jsonResponse(data, status);
}

function html(markup: string, status = 200) {
  return () => htmlResponse(markup, status);
}

function networkFailure(message = 'fetch failed') {
  const err = new TypeError(message);
  (err as any).code = 'ENOTFOUND';
  return err;
}

// ---------------------------------------------------------------------------
// Helpers de datos simulados
// ---------------------------------------------------------------------------

const SET_PAGE_URL = 'https://soundcloud.com/djprueba/sets/mi-set';
const WIDGET_PREFIX = 'https://w.soundcloud.com/player/';
const RESOLVE_PREFIX = 'https://api-v2.soundcloud.com/resolve';
const PLAYLIST_TRACKS_PREFIX = 'https://api-v2.soundcloud.com/playlists/987654/tracks';

const CLIENT_ID = 'abcdefghijklmnopqrstuvwx123456';

function setPage(hydration: unknown[]): string {
  return (
    '<!DOCTYPE html><html><head><title>Mi Set | SoundCloud</title></head><body>' +
    `<script>window.__sc_hydration = ${JSON.stringify(hydration)};</script>` +
    '</body></html>'
  );
}

function clientIdPage(): string {
  return (
    '<html><body><script src="https://a-v2.sndcdn.com/assets/app.js"></script>' +
    `<script>window.__sc_hydration = [];var x={"client_id":"${CLIENT_ID}"};</script>` +
    '</body></html>'
  );
}

function scTrack(
  id: number,
  title: string,
  username: string,
  extra: Record<string, any> = {}
) {
  return {
    id,
    kind: 'track',
    title,
    duration: 222000,
    artwork_url: `https://i1.sndcdn.com/artworks-${id}-large.jpg`,
    user: { username },
    ...extra,
  };
}

function playlistData(tracks: any[], extra: Record<string, any> = {}) {
  return {
    kind: 'playlist',
    id: 987654,
    title: 'Mi Set de SoundCloud',
    artwork_url: 'https://i1.sndcdn.com/artworks-set-large.jpg',
    tracks,
    ...extra,
  };
}

function hydrationFor(data: any) {
  return [{ hydratable: 'playlist', data }];
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

const extractor = new SoundCloudExtractor();

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Parsing de URLs
// ---------------------------------------------------------------------------

describe('SoundCloudExtractor.extractPlaylistId', () => {
  it('extrae usuario y slug de un set estándar', () => {
    expect(extractor.extractPlaylistId('https://soundcloud.com/djprueba/sets/mi-set')).toBe(SET_ID);
    expect(
      extractor.extractPlaylistId('https://www.soundcloud.com/djprueba/sets/mi-set?si=abc#x')
    ).toBe(SET_ID);
    expect(extractor.extractPlaylistId('m.soundcloud.com/djprueba/sets/mi-set')).toBe(SET_ID);
    expect(extractor.extractPlaylistId('https://soundcloud.com/sets/mi-set')).toBe('sets/mi-set');
  });

  it('rechaza tracks sueltos, perfiles, rutas reservadas y hosts ajenos', () => {
    expect(extractor.extractPlaylistId('')).toBeNull();
    expect(extractor.extractPlaylistId('https://soundcloud.com/djprueba/mi-track')).toBeNull();
    expect(extractor.extractPlaylistId('https://soundcloud.com/djprueba')).toBeNull();
    expect(extractor.extractPlaylistId('https://soundcloud.com/discover/sets/charts')).toBeNull();
    expect(
      extractor.extractPlaylistId('https://soundcloud.com/djprueba/sets/nombre?in=djprueba/sets/x')
    ).toBe('djprueba/sets/nombre');
    expect(extractor.extractPlaylistId('https://example.com/djprueba/sets/mi-set')).toBeNull();
    expect(extractor.extractPlaylistId('esto no es una url')).toBeNull();
  });
});

describe('SoundCloudExtractor.canHandle', () => {
  it('reconoce sets y enlaces cortos, y rechaza el resto', () => {
    expect(extractor.canHandle('https://soundcloud.com/djprueba/sets/mi-set?si=x')).toBe(true);
    expect(extractor.canHandle('https://on.soundcloud.com/AbCdEf123')).toBe(true);
    expect(extractor.canHandle('https://soundcloud.com/djprueba/mi-track')).toBe(false);
    expect(extractor.canHandle('https://example.com/djprueba/sets/mi-set')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// extract: hidratación del HTML público
// ---------------------------------------------------------------------------

describe('SoundCloudExtractor.extract (hidratación)', () => {
  it('mapea las pistas del estado embebido, normaliza portadas y deduplica', async () => {
    mockFetch([
      {
        match: SET_PAGE_URL,
        response: html(
          setPage(
            hydrationFor(
              playlistData([
                scTrack(1, 'Pista 1', 'DJ Prueba'),
                scTrack(1, 'Pista 1', 'DJ Prueba'), // duplicada
                scTrack(2, 'Pista 2', 'DJ Prueba', { artwork_url: null }),
                { id: 3, kind: 'track', title: '   ' }, // sin título: se ignora
                scTrack(4, 'Pista 4', 'DJ Prueba', {
                  publisher_metadata: { artist: 'Artista Real', album_title: 'Álbum Real' },
                }),
              ])
            )
          )
        ),
      },
    ]);

    const result = await extractor.extract('https://soundcloud.com/djprueba/sets/mi-set?si=abc');

    expect(result.platform).toBe('soundcloud');
    expect(result.playlistId).toBe(SET_ID);
    expect(result.playlistTitle).toBe('Mi Set de SoundCloud');
    expect(result.tracks.map((track) => track.id)).toEqual(['1', '2', '4']);
    expect(result.totalTracks).toBe(3);

    expect(result.tracks[0].mainArtist).toBe('DJ Prueba');
    expect(result.tracks[0].durationText).toBe('3:42');
    expect(result.tracks[0].coverUrl).toBe('https://i1.sndcdn.com/artworks-1-t500x500.jpg');
    expect(result.tracks[0].thumbnailUrl).toBe('https://i1.sndcdn.com/artworks-1-t500x500.jpg');

    // Sin portada propia se usa la del set.
    expect(result.tracks[1].coverUrl).toBe('https://i1.sndcdn.com/artworks-set-t500x500.jpg');

    // El metadata de publicación prevalece sobre el uploader.
    expect(result.tracks[2].mainArtist).toBe('Artista Real');
    expect(result.tracks[2].albumName).toBe('Álbum Real');
  });

  it('encuentra la playlist aunque la hidratación tenga ruido y títulos con corchetes', async () => {
    const data = playlistData([
      scTrack(1, 'Pista [Remix] "especial"', 'DJ Prueba', { duration: 45000 }),
    ]);

    mockFetch([
      {
        match: SET_PAGE_URL,
        response: html(
          setPage([{ hydratable: 'user', data: { id: 1 } }, ...hydrationFor(data)])
        ),
      },
    ]);

    const result = await extractor.extract(SET_PAGE_URL);

    expect(result.tracks).toHaveLength(1);
    expect(result.tracks[0].title).toBe('Pista [Remix] "especial"');
    expect(result.tracks[0].durationText).toBe('0:45');
  });
});

// ---------------------------------------------------------------------------
// extract: fallback a la API v2 pública y al widget
// ---------------------------------------------------------------------------

describe('SoundCloudExtractor.extract (API v2 y widget)', () => {
  it('resuelve el set con la API v2 y pagina las pistas', async () => {
    const calls = mockFetch([
      { match: SET_PAGE_URL, response: html(clientIdPage()) },
      {
        match: PLAYLIST_TRACKS_PREFIX,
        response: json({
          collection: [scTrack(2, 'Pista API 2', 'DJ API'), scTrack(1, 'Pista API 1', 'DJ API')],
          next_href: null,
        }),
      },
      {
        match: RESOLVE_PREFIX,
        response: json({
          kind: 'playlist',
          id: 987654,
          title: 'Set vía API',
          tracks: [scTrack(1, 'Pista API 1', 'DJ API')],
          // `stub: true` marca que la respuesta trae solo las primeras pistas.
          stub: true,
        }),
      },
    ]);

    const result = await extractor.extract(SET_PAGE_URL);

    expect(result.playlistId).toBe(SET_ID);
    expect(result.playlistTitle).toBe('Set vía API');
    expect(result.tracks.map((track) => track.id)).toEqual(['2', '1']);
    expect(result.totalTracks).toBe(2);

    const resolveCall = calls.calls.find((call) => call.url.includes('/resolve'));
    expect(resolveCall?.url).toContain(`client_id=${CLIENT_ID}`);
  });

  it('usa directamente las pistas del resolve cuando no es un stub', async () => {
    mockFetch([
      { match: SET_PAGE_URL, response: html(clientIdPage()) },
      {
        match: RESOLVE_PREFIX,
        response: json({
          kind: 'playlist',
          id: 987654,
          title: 'Set Completo',
          tracks: [scTrack(5, 'Pista Directa', 'DJ API')],
        }),
      },
    ]);

    const result = await extractor.extract(SET_PAGE_URL);

    expect(result.playlistTitle).toBe('Set Completo');
    expect(result.tracks.map((track) => track.id)).toEqual(['5']);
  });

  it('cae al widget público cuando no hay hidratación ni client_id', async () => {
    const widgetHtml = `<html><body><script>window.__sc_hydration = ${JSON.stringify(
      hydrationFor(playlistData([scTrack(7, 'Pista Widget', 'DJ Widget')]))
    )};</script></body></html>`;

    const calls = mockFetch([
      { match: SET_PAGE_URL, response: html('<html><body>Sin datos embebidos</body></html>') },
      { match: WIDGET_PREFIX, response: html(widgetHtml) },
    ]);

    const result = await extractor.extract(SET_PAGE_URL);

    expect(result.tracks.map((track) => track.id)).toEqual(['7']);
    expect(result.playlistTitle).toBe('Mi Set de SoundCloud');
    expect(calls.calls[1].url).toContain(encodeURIComponent(SET_PAGE_URL));
  });

  it('resuelve enlaces cortos on.soundcloud.com', async () => {
    mockFetch([
      {
        match: 'https://on.soundcloud.com/AbCdEf123',
        response: () => ({
          ok: true,
          status: 200,
          url: 'https://soundcloud.com/djprueba/sets/mi-set?si=abc',
          json: async () => ({}),
          text: async () => '<html></html>',
        }),
      },
      {
        match: SET_PAGE_URL,
        response: html(setPage(hydrationFor(playlistData([scTrack(1, 'Pista', 'DJ')])))),
      },
    ]);

    const result = await extractor.extract('https://on.soundcloud.com/AbCdEf123');

    expect(result.playlistId).toBe(SET_ID);
    expect(result.tracks).toHaveLength(1);
  });

  it('extrae la URL canónica del HTML cuando el enlace corto no redirige', async () => {
    mockFetch([
      {
        match: 'https://on.soundcloud.com/AbCdEf123',
        response: html(
          `<html><body><a href="https://soundcloud.com/djprueba/sets/mi-set">Escuchar</a></body></html>`
        ),
      },
      {
        match: SET_PAGE_URL,
        response: html(setPage(hydrationFor(playlistData([scTrack(1, 'Pista', 'DJ')])))),
      },
    ]);

    const result = await extractor.extract('https://on.soundcloud.com/AbCdEf123');
    expect(result.playlistId).toBe(SET_ID);
  });
});

// ---------------------------------------------------------------------------
// extract: errores descriptivos
// ---------------------------------------------------------------------------

describe('SoundCloudExtractor.extract (errores)', () => {
  it('describe un set inexistente con HTTP 404', async () => {
    mockFetch([{ match: SET_PAGE_URL, response: html('Not found', 404) }]);

    await expect(extractor.extract(SET_PAGE_URL)).rejects.toThrow(
      /no existe, fue eliminado o es privado/
    );
  });

  it('describe un set privado con HTTP 403', async () => {
    mockFetch([{ match: SET_PAGE_URL, response: html('Forbidden', 403) }]);

    await expect(extractor.extract(SET_PAGE_URL)).rejects.toThrow(/es privado/);
  });

  it('describe un set vacío detectado en la hidratación', async () => {
    mockFetch([{ match: SET_PAGE_URL, response: html(setPage(hydrationFor(playlistData([])))) }]);

    await expect(extractor.extract(SET_PAGE_URL)).rejects.toThrow(/no contiene canciones/);
  });

  it('reporta un error genérico cuando el HTML no trae datos y la API falla', async () => {
    mockFetch([
      { match: SET_PAGE_URL, response: html(clientIdPage()) },
      { match: RESOLVE_PREFIX, response: json({}, 500) },
      { match: WIDGET_PREFIX, response: html('<html></html>') },
    ]);

    await expect(extractor.extract(SET_PAGE_URL)).rejects.toThrow(
      /No se pudo extraer el set de SoundCloud/
    );
  });

  it('propaga el error de red sin enmascarar', async () => {
    mockFetch([{ match: SET_PAGE_URL, reject: networkFailure() }]);

    await expect(extractor.extract(SET_PAGE_URL)).rejects.toThrow(/fetch failed/);
  });

  it('falla con un mensaje claro cuando el enlace corto no se puede resolver', async () => {
    mockFetch([
      { match: 'https://on.soundcloud.com/AbCdEf123', response: html('<html></html>') },
    ]);

    await expect(extractor.extract('https://on.soundcloud.com/AbCdEf123')).rejects.toThrow(
      /No se pudo resolver el enlace corto/
    );
  });

  it('rechaza con mensaje claro cuando la URL no es válida', async () => {
    await expect(extractor.extract('https://soundcloud.com/djprueba/mi-track')).rejects.toThrow(
      /URL de SoundCloud inválida/
    );
    await expect(extractor.extract('esto no es una url')).rejects.toThrow(
      /URL de SoundCloud inválida/
    );
  });

  it('rechaza hosts ajenos con un mensaje claro', async () => {
    await expect(extractor.extract('https://example.com/djprueba/sets/mi-set')).rejects.toThrow(
      /URL de SoundCloud inválida/
    );
  });
});

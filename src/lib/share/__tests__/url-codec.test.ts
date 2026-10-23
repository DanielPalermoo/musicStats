import { describe, expect, it } from 'vitest';

import {
  buildShareUrl,
  decodeSharePayload,
  encodeSharePayload,
  MAX_SHARE_PAYLOAD_LENGTH,
  SHARE_QUERY_PARAM,
  ShareCodecError,
  type ShareCodecErrorCode,
  type SharePayload,
} from '@/lib/share/url-codec';
import { calculateMusicStats } from '@/lib/stats/calculator';
import type { ExtractedTrack } from '@/types/playlist';
import type { ArtistStats, PlaylistStats } from '@/types/stats';

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function encodeRaw(json: string): string {
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function encodeWire(value: unknown): string {
  return encodeRaw(JSON.stringify(value));
}

function expectDecoded(encoded: string): SharePayload {
  const decoded = decodeSharePayload(encoded);
  if (!decoded.ok) {
    throw new Error(
      `Se esperaba un payload válido, pero falló con ${decoded.error.code}: ${decoded.error.message}`
    );
  }
  return decoded.payload;
}

function expectDecodeError(
  encoded: string | null | undefined,
  code?: ShareCodecErrorCode
): ShareCodecError {
  const decoded = decodeSharePayload(encoded);
  expect(decoded.ok).toBe(false);
  if (decoded.ok) {
    throw new Error('Se esperaba un error de decodificación.');
  }
  expect(decoded.error).toBeInstanceOf(ShareCodecError);
  if (code) expect(decoded.error.code).toBe(code);
  return decoded.error;
}

function expectEncodeError(payload: unknown, code: ShareCodecErrorCode): void {
  try {
    encodeSharePayload(payload as SharePayload);
    throw new Error('Se esperaba que encodeSharePayload lanzara un error.');
  } catch (error) {
    expect(error).toBeInstanceOf(ShareCodecError);
    if (error instanceof ShareCodecError) {
      expect(error.code).toBe(code);
    }
  }
}

function makeArtist(index: number, overrides: Partial<ArtistStats> = {}): ArtistStats {
  const key = `artist-${index}`;
  return {
    key,
    name: `Artista ${index}`,
    appearanceCount: 1,
    mainTrackCount: 1,
    featuredTrackCount: 0,
    tracks: [
      {
        trackId: `track-${index}`,
        trackTitle: `Canción ${index}`,
        isMainArtist: true,
        collaborators: [],
      },
    ],
    collaborations: [],
    ...overrides,
  };
}

function makePayload(stats: PlaylistStats): SharePayload {
  return {
    platform: 'spotify',
    playlistId: '37i9dQZF1DXcBWIGoYBM5M',
    playlistTitle: 'Playlist de prueba',
    stats,
  };
}

function minimalPayload(): SharePayload {
  const alpha: ArtistStats = {
    key: 'alpha',
    name: 'Alpha',
    appearanceCount: 1,
    mainTrackCount: 1,
    featuredTrackCount: 0,
    tracks: [
      {
        trackId: 'track-1',
        trackTitle: 'Uno',
        isMainArtist: true,
        collaborators: [],
      },
    ],
    collaborations: [],
  };

  return {
    platform: 'youtube_music',
    playlistId: 'PL1234567890abcdef',
    playlistTitle: 'Mi playlist',
    stats: {
      totalTracks: 1,
      totalArtists: 1,
      topArtist: alpha,
      podium: [{ rank: 1, artist: alpha, featuredTracks: ['Uno'] }],
      artists: [alpha],
    },
  };
}

function makeTrack(
  id: string,
  title: string,
  mainArtist: string,
  allArtists: string[],
  extra: Partial<ExtractedTrack> = {}
): ExtractedTrack {
  return { id, title, mainArtist, allArtists, ...extra };
}

interface RawArtist {
  k: string;
  n: string;
  c: number;
  m: number;
  f: number;
  tr: unknown[];
  co: unknown[];
}

interface RawWire {
  v: number;
  p: string;
  i: string;
  t: string;
  tt: number;
  ta: number;
  a: RawArtist[];
  th?: string[];
}

function validRawWire(): RawWire {
  return {
    v: 1,
    p: 's',
    i: 'PL1234567890',
    t: 'Playlist de prueba',
    tt: 1,
    ta: 1,
    a: [
      {
        k: 'alpha',
        n: 'Alpha',
        c: 1,
        m: 1,
        f: 0,
        tr: [['track-1', 'Uno', 1, []]],
        co: [],
      },
    ],
  };
}

/* ------------------------------------------------------------------ */
/* Round-trip                                                         */
/* ------------------------------------------------------------------ */

describe('encodeSharePayload / decodeSharePayload', () => {
  it('hace round-trip de un payload mínimo', () => {
    const payload = minimalPayload();
    const decoded = expectDecoded(encodeSharePayload(payload));

    expect(decoded).toEqual(payload);
  });

  it('hace round-trip de un payload complejo con colaboraciones y portadas', () => {
    const stats = calculateMusicStats([
      makeTrack('t1', 'Dúo estelar', 'Alpha', ['Alpha', 'Beta'], {
        thumbnailUrl: 'https://images.example.com/alpha.jpg',
      }),
      makeTrack('t2', 'Trío nocturno', 'Alpha', ['Alpha', 'Beta', 'Gamma'], {
        coverUrl: 'https://images.example.com/beta.jpg',
      }),
      makeTrack('t3', 'Solo de Gamma', 'Gamma', ['Gamma'], {
        thumbnailUrl: 'https://images.example.com/gamma.jpg',
      }),
      makeTrack('t4', 'Otra de Beta', 'Beta', ['Beta']),
      makeTrack('t5', 'Colaboración final', 'Delta', ['Delta', 'Alpha'], {
        thumbnailUrl: 'https://images.example.com/delta.jpg',
      }),
    ]);

    const payload: SharePayload = {
      platform: 'spotify',
      playlistId: '37i9dQZF1DXcBWIGoYBM5M',
      playlistTitle: 'Éxitos & colaboraciones ✨',
      stats,
    };

    const decoded = expectDecoded(encodeSharePayload(payload));

    expect(decoded).toEqual(payload);
    expect(decoded.playlistTitle).toContain('✨');
    expect(decoded.stats.artists[0].collaborations.length).toBeGreaterThan(0);
  });

  it('hace round-trip de una playlist vacía', () => {
    const payload = makePayload({
      totalTracks: 0,
      totalArtists: 0,
      topArtist: null,
      podium: [],
      artists: [],
    });

    const decoded = expectDecoded(encodeSharePayload(payload));

    expect(decoded).toEqual(payload);
    expect(decoded.stats.topArtist).toBeNull();
    expect(decoded.stats.podium).toEqual([]);
  });

  it('genera un string Base64URL sin caracteres reservados ni padding', () => {
    const encoded = encodeSharePayload(minimalPayload());

    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(encoded).not.toContain('+');
    expect(encoded).not.toContain('/');
    expect(encoded).not.toContain('=');
  });

  it('acepta padding "=" al decodificar por tolerancia', () => {
    const encoded = encodeSharePayload(minimalPayload());
    expectDecoded(`${encoded}==`);
  });

  it('preserva los totales y el orden de los artistas', () => {
    const artists = Array.from({ length: 4 }, (_, index) => makeArtist(index));
    const stats: PlaylistStats = {
      totalTracks: 4,
      totalArtists: 4,
      topArtist: artists[0],
      podium: artists.slice(0, 3).map((artist, index) => ({
        rank: (index + 1) as 1 | 2 | 3,
        artist,
        featuredTracks: artist.tracks.map((track) => track.trackTitle),
      })),
      artists,
    };

    const decoded = expectDecoded(encodeSharePayload(makePayload(stats)));

    expect(decoded.stats.totalTracks).toBe(4);
    expect(decoded.stats.totalArtists).toBe(4);
    expect(decoded.stats.artists.map((artist) => artist.key)).toEqual(
      artists.map((artist) => artist.key)
    );
    expect(decoded.stats.topArtist?.key).toBe('artist-0');
    expect(decoded.stats.podium.map((entry) => entry.rank)).toEqual([1, 2, 3]);
  });

  it('recorta artistas y detalle cuando el payload excede el límite de tamaño', () => {
    const artists = Array.from({ length: 120 }, (_, index) =>
      makeArtist(index, {
        appearanceCount: 30,
        mainTrackCount: 30,
        featuredTrackCount: 0,
        tracks: Array.from({ length: 30 }, (_, trackIndex) => ({
          trackId: `artist-${index}-track-${trackIndex}`,
          trackTitle: `Canción ${index}-${trackIndex} con un título deliberadamente largo`,
          isMainArtist: true,
          collaborators: ['Colaborador Uno', 'Colaborador Dos'],
        })),
        collaborations: Array.from({ length: 20 }, (_, collabIndex) => ({
          artist: `Colaborador ${collabIndex}`,
          sharedTrackCount: 10,
          sharedTracks: Array.from(
            { length: 10 },
            (_, trackIndex) => `Tema compartido ${collabIndex}-${trackIndex}`
          ),
        })),
      })
    );

    const stats: PlaylistStats = {
      totalTracks: 3_600,
      totalArtists: 120,
      topArtist: artists[0],
      podium: artists.slice(0, 3).map((artist, index) => ({
        rank: (index + 1) as 1 | 2 | 3,
        artist,
        featuredTracks: ['Destacada'],
      })),
      artists,
    };

    const encoded = encodeSharePayload(makePayload(stats));
    expect(encoded.length).toBeLessThanOrEqual(MAX_SHARE_PAYLOAD_LENGTH);

    const decoded = expectDecoded(encoded);
    expect(decoded.stats.totalArtists).toBe(120);
    expect(decoded.stats.artists.length).toBeLessThanOrEqual(50);
    expect(decoded.stats.artists.length).toBeGreaterThan(0);
    expect(decoded.stats.podium).toHaveLength(3);
  });

  it('nunca codifica más artistas que el máximo permitido', () => {
    const artists = Array.from({ length: 80 }, (_, index) => makeArtist(index));
    const stats: PlaylistStats = {
      totalTracks: 80,
      totalArtists: 80,
      topArtist: artists[0],
      podium: artists.slice(0, 3).map((artist, index) => ({
        rank: (index + 1) as 1 | 2 | 3,
        artist,
        featuredTracks: ['Destacada'],
      })),
      artists,
    };

    const decoded = expectDecoded(encodeSharePayload(makePayload(stats)));

    expect(decoded.stats.totalArtists).toBe(80);
    expect(decoded.stats.artists).toHaveLength(50);
  });
});

/* ------------------------------------------------------------------ */
/* Construcción de URL                                                */
/* ------------------------------------------------------------------ */

describe('buildShareUrl', () => {
  it('agrega el parámetro share conservando query params y hash', () => {
    const url = buildShareUrl(
      'https://musicstats.example.com/?utm=test#resultados',
      minimalPayload()
    );
    const parsed = new URL(url);

    expect(parsed.origin).toBe('https://musicstats.example.com');
    expect(parsed.searchParams.get('utm')).toBe('test');
    expect(parsed.hash).toBe('#resultados');

    const share = parsed.searchParams.get(SHARE_QUERY_PARAM);
    expect(share).toBeTruthy();
    expect(expectDecoded(share ?? '')).toEqual(minimalPayload());
  });

  it('reemplaza un parámetro share previo en lugar de duplicarlo', () => {
    const first = buildShareUrl('https://example.com/', minimalPayload());
    const second = buildShareUrl(first, minimalPayload());
    const parsed = new URL(second);

    expect(parsed.searchParams.getAll(SHARE_QUERY_PARAM)).toHaveLength(1);
  });
});

/* ------------------------------------------------------------------ */
/* Strings malformados                                                */
/* ------------------------------------------------------------------ */

describe('decodeSharePayload - entradas malformadas', () => {
  it('reporta valores vacíos o ausentes', () => {
    expectDecodeError(null, 'empty');
    expectDecodeError(undefined, 'empty');
    expectDecodeError('', 'empty');
    expectDecodeError('   ', 'empty');
  });

  it('reporta una codificación Base64URL inválida', () => {
    expectDecodeError('%%%no-es-base64%%%', 'invalid_encoding');
    expectDecodeError('abc$der', 'invalid_encoding');
    expectDecodeError('a', 'invalid_encoding');
  });

  it('reporta JSON inválido', () => {
    expectDecodeError(encodeRaw('esto no es json'), 'invalid_json');
  });

  it('reporta strings truncados sin lanzar excepciones', () => {
    const encoded = encodeSharePayload(minimalPayload());
    const truncated = encoded.slice(0, Math.max(1, Math.floor(encoded.length * 0.7)));

    const error = expectDecodeError(truncated);
    expect([
      'invalid_encoding',
      'invalid_json',
      'invalid_structure',
    ]).toContain(error.code);
  });

  it('rechaza payloads que superan el tamaño máximo', () => {
    expectDecodeError('A'.repeat(MAX_SHARE_PAYLOAD_LENGTH + 1), 'payload_too_large');
  });

  it('rechaza JSON que no es un objeto', () => {
    expectDecodeError(encodeRaw('null'), 'invalid_structure');
    expectDecodeError(encodeRaw('[]'), 'invalid_structure');
    expectDecodeError(encodeRaw('"texto"'), 'invalid_structure');
  });

  it('reporta versiones no soportadas', () => {
    const wire = validRawWire();
    wire.v = 2;
    expectDecodeError(encodeWire(wire), 'unsupported_version');
  });
});

describe('decodeSharePayload - validación estructural', () => {
  it('acepta un wire válido', () => {
    const payload = expectDecoded(encodeWire(validRawWire()));

    expect(payload.platform).toBe('spotify');
    expect(payload.stats.topArtist?.name).toBe('Alpha');
    expect(payload.stats.podium[0].featuredTracks).toEqual(['Uno']);
  });

  it('rechaza plataformas desconocidas', () => {
    const wire = validRawWire();
    wire.p = 'x';
    expectDecodeError(encodeWire(wire), 'invalid_structure');

    const prototypeKey = validRawWire();
    prototypeKey.p = 'toString';
    expectDecodeError(encodeWire(prototypeKey), 'invalid_structure');
  });

  it('rechaza playlistId con caracteres de inyección', () => {
    const wire = validRawWire();
    wire.i = '<script>alert(1)</script>';
    expectDecodeError(encodeWire(wire), 'invalid_structure');
  });

  it('rechaza títulos con caracteres de control', () => {
    const wire = validRawWire();
    wire.t = 'Playlist\u0000maliciosa';
    expectDecodeError(encodeWire(wire), 'invalid_structure');
  });

  it('rechaza totales no enteros, negativos o fuera de rango', () => {
    const fractional = validRawWire();
    fractional.tt = 1.5;
    expectDecodeError(encodeWire(fractional), 'invalid_structure');

    const negative = validRawWire();
    negative.tt = -1;
    expectDecodeError(encodeWire(negative), 'invalid_structure');

    const huge = validRawWire();
    huge.ta = 100_001;
    expectDecodeError(encodeWire(huge), 'invalid_structure');

    const text = validRawWire();
    (text as unknown as { tt: string }).tt = '1';
    expectDecodeError(encodeWire(text), 'invalid_structure');
  });

  it('rechaza listas de artistas inconsistentes', () => {
    const fewerTotal = validRawWire();
    fewerTotal.a.push({ ...validRawWire().a[0], k: 'beta', n: 'Beta' });
    fewerTotal.tt = 2;
    fewerTotal.ta = 1;
    expectDecodeError(encodeWire(fewerTotal), 'invalid_structure');

    const duplicate = validRawWire();
    duplicate.a.push({ ...validRawWire().a[0] });
    duplicate.tt = 2;
    duplicate.ta = 2;
    expectDecodeError(encodeWire(duplicate), 'invalid_structure');

    const tooMany = validRawWire();
    tooMany.a = Array.from({ length: 51 }, (_, index) => {
      const artist = validRawWire().a[0];
      return { ...artist, k: `artist-${index}`, n: `Artista ${index}` };
    });
    tooMany.tt = 51;
    tooMany.ta = 51;
    expectDecodeError(encodeWire(tooMany), 'invalid_structure');
  });

  it('rechaza conteos de aparición inconsistentes', () => {
    const wire = validRawWire();
    wire.a[0].c = 2;
    wire.a[0].m = 1;
    wire.a[0].f = 0;
    expectDecodeError(encodeWire(wire), 'invalid_structure');
  });

  it('rechaza pistas con formato o tipos inválidos', () => {
    const badShape = validRawWire();
    badShape.a[0].tr = [['track-1', 'Uno', 1]];
    expectDecodeError(encodeWire(badShape), 'invalid_structure');

    const badMainFlag = validRawWire();
    badMainFlag.a[0].tr = [['track-1', 'Uno', 2, []]];
    expectDecodeError(encodeWire(badMainFlag), 'invalid_structure');

    const badCollaborators = validRawWire();
    badCollaborators.a[0].tr = [['track-1', 'Uno', 1, 'Beta']];
    expectDecodeError(encodeWire(badCollaborators), 'invalid_structure');

    const moreTracksThanAppearances = validRawWire();
    moreTracksThanAppearances.a[0].tr = [
      ['track-1', 'Uno', 1, []],
      ['track-2', 'Dos', 1, []],
    ];
    expectDecodeError(encodeWire(moreTracksThanAppearances), 'invalid_structure');
  });

  it('rechaza colaboraciones con conteos imposibles', () => {
    const wire = validRawWire();
    wire.a[0].co = [['Beta', 2, ['Uno']]];
    expectDecodeError(encodeWire(wire), 'invalid_structure');
  });

  it('rechaza miniaturas con protocolos peligrosos o URLs inválidas', () => {
    const javascriptUrl = validRawWire();
    javascriptUrl.th = ['javascript:alert(1)'];
    expectDecodeError(encodeWire(javascriptUrl), 'invalid_structure');

    const malformed = validRawWire();
    malformed.th = ['no-es-una-url'];
    expectDecodeError(encodeWire(malformed), 'invalid_structure');

    const tooMany = validRawWire();
    tooMany.th = [
      'https://images.example.com/a.jpg',
      'https://images.example.com/b.jpg',
      'https://images.example.com/c.jpg',
      'https://images.example.com/d.jpg',
    ];
    expectDecodeError(encodeWire(tooMany), 'invalid_structure');
  });
});

/* ------------------------------------------------------------------ */
/* Validación al codificar                                            */
/* ------------------------------------------------------------------ */

describe('encodeSharePayload - validación de entrada', () => {
  it('rechaza plataformas no soportadas', () => {
    expectEncodeError(
      { ...minimalPayload(), platform: 'deezer' },
      'invalid_structure'
    );
  });

  it('rechaza playlistId con caracteres no permitidos', () => {
    expectEncodeError(
      { ...minimalPayload(), playlistId: '"><script>alert(1)</script>' },
      'invalid_structure'
    );
  });

  it('rechaza stats inválidas o totales inconsistentes', () => {
    expectEncodeError({ ...minimalPayload(), stats: null }, 'invalid_structure');
    expectEncodeError(
      {
        ...minimalPayload(),
        stats: { ...minimalPayload().stats, totalTracks: -1 },
      },
      'invalid_structure'
    );
    expectEncodeError(
      {
        ...minimalPayload(),
        stats: { ...minimalPayload().stats, totalArtists: 0 },
      },
      'invalid_structure'
    );
  });
});

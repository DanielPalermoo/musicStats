import { describe, expect, it } from 'vitest';

import {
  UNKNOWN_ARTIST,
  extractCollaborators,
  extractCollaboratorsFromTitle,
  getTrackArtists,
  normalizeArtistName,
} from '@/lib/stats/normalizer';
import type { ExtractedTrack } from '@/types/playlist';

function makeTrack(
  overrides: Partial<ExtractedTrack> & Pick<ExtractedTrack, 'id'>
): ExtractedTrack {
  return {
    title: 'Canción',
    mainArtist: 'Artista A',
    allArtists: ['Artista A'],
    ...overrides,
  };
}

describe('normalizeArtistName', () => {
  it('quita el sufijo "- Topic" con espacios y mayúsculas variables', () => {
    expect(normalizeArtistName('Bad Bunny - Topic')).toEqual({
      key: 'bad bunny',
      displayName: 'Bad Bunny',
    });
    expect(normalizeArtistName('KAROL G-topic')).toEqual({
      key: 'karol g',
      displayName: 'KAROL G',
    });
    expect(normalizeArtistName('  Tiago Pzk  -   topic  ')).toEqual({
      key: 'tiago pzk',
      displayName: 'Tiago Pzk',
    });
  });

  it('quita el sufijo "VEVO" pegado o con espacio', () => {
    expect(normalizeArtistName('Dua Lipa VEVO')).toEqual({
      key: 'dua lipa',
      displayName: 'Dua Lipa',
    });
    expect(normalizeArtistName('SomeArtistVEVO')).toEqual({
      key: 'someartist',
      displayName: 'SomeArtist',
    });
  });

  it('preserva el sufijo "- Topic" cuando no está al final del nombre', () => {
    expect(normalizeArtistName('Artist - Topic Remix')).toEqual({
      key: 'artist - topic remix',
      displayName: 'Artist - Topic Remix',
    });
  });

  it('genera la clave sin diacríticos pero conserva el displayName original', () => {
    expect(normalizeArtistName('Babasónicos')).toEqual({
      key: 'babasonicos',
      displayName: 'Babasónicos',
    });
    expect(normalizeArtistName('Señor Flamenco')).toEqual({
      key: 'senor flamenco',
      displayName: 'Señor Flamenco',
    });
  });

  it('colapsa espacios y limpia puntuación periférica', () => {
    expect(normalizeArtistName('  Señor   Flamenco  ')).toEqual({
      key: 'senor flamenco',
      displayName: 'Señor Flamenco',
    });
    expect(normalizeArtistName('"Artist A"')).toEqual({
      key: 'artist a',
      displayName: 'Artist A',
    });
    expect(normalizeArtistName('[Artist B]')).toEqual({
      key: 'artist b',
      displayName: 'Artist B',
    });
    expect(normalizeArtistName('—Artist C—')).toEqual({
      key: 'artist c',
      displayName: 'Artist C',
    });
  });

  it('devuelve null para entradas vacías o sin nombre meaningful', () => {
    expect(normalizeArtistName('')).toBeNull();
    expect(normalizeArtistName('   ')).toBeNull();
    expect(normalizeArtistName(' - Topic')).toBeNull();
    expect(normalizeArtistName('   -   Topic   ')).toBeNull();
  });
});

describe('extractCollaborators', () => {
  it('separa por comas y "&"', () => {
    expect(extractCollaborators('Bad Bunny, Jhay Cortez & Farru')).toEqual([
      'Bad Bunny',
      'Jhay Cortez',
      'Farru',
    ]);
    expect(extractCollaborators('Solo Artist')).toEqual(['Solo Artist']);
  });

  it('separa por feat./ft./featuring', () => {
    expect(extractCollaborators('Bad Bunny feat. Jhay Cortez')).toEqual([
      'Bad Bunny',
      'Jhay Cortez',
    ]);
    expect(extractCollaborators('Artist A ft. Artist B')).toEqual([
      'Artist A',
      'Artist B',
    ]);
    expect(extractCollaborators('Artist A featuring Artist B')).toEqual([
      'Artist A',
      'Artist B',
    ]);
    expect(extractCollaborators('feat. Artist A')).toEqual(['Artist A']);
  });

  it('separa por "with", "vs." e "y" (español)', () => {
    expect(extractCollaborators('Artist A with Artist B')).toEqual([
      'Artist A',
      'Artist B',
    ]);
    expect(extractCollaborators('Artist A vs. Artist B')).toEqual([
      'Artist A',
      'Artist B',
    ]);
    expect(extractCollaborators('Artista A y Artista B')).toEqual([
      'Artista A',
      'Artista B',
    ]);
  });

  it('separa por "x" cuando va entre nombres', () => {
    expect(extractCollaborators('KAROL G x TIAGO PZK')).toEqual([
      'KAROL G',
      'TIAGO PZK',
    ]);
  });

  it('NO trata "X"/"Y" sueltos al inicio o final como separador', () => {
    expect(extractCollaborators('Artist X')).toEqual(['Artist X']);
    expect(extractCollaborators('Y Artist')).toEqual(['Y Artist']);
    expect(extractCollaborators('X')).toEqual(['X']);
  });

  it('filtra segmentos de ruido (Official Video, Lyrics, etc.)', () => {
    expect(extractCollaborators('Artist A, Official Video')).toEqual([
      'Artist A',
    ]);
    expect(extractCollaborators('Artist A & Lyric Video, Live')).toEqual([
      'Artist A',
    ]);
  });

  it('limpia comillas, corchetes y guiones de los extremos', () => {
    expect(extractCollaborators('  "Artist A"  ')).toEqual(['Artist A']);
    expect(extractCollaborators('[Artist B]')).toEqual(['Artist B']);
    expect(extractCollaborators('- Artist C -')).toEqual(['Artist C']);
  });
});

describe('extractCollaboratorsFromTitle', () => {
  it('extrae colaboradores de paréntesis con keyword', () => {
    expect(extractCollaboratorsFromTitle('Canción (feat. Artista B)')).toEqual([
      'Artista B',
    ]);
    expect(
      extractCollaboratorsFromTitle('Canción (feat. Artista B, Artista C)')
    ).toEqual(['Artista B', 'Artista C']);
    expect(
      extractCollaboratorsFromTitle('Canción (ft. Artista B) [Remix]')
    ).toEqual(['Artista B']);
  });

  it('ignora paréntesis sin keyword de colaboración', () => {
    expect(extractCollaboratorsFromTitle('Canción (Official Video)')).toEqual(
      []
    );
    expect(extractCollaboratorsFromTitle('Canción Simple')).toEqual([]);
    expect(
      extractCollaboratorsFromTitle('Canción (feat. A) (Official Video)')
    ).toEqual(['A']);
  });

  it('extrae colaboradores de corchetes con keyword', () => {
    expect(extractCollaboratorsFromTitle('Canción [feat. Artista B]')).toEqual(
      ['Artista B']
    );
    expect(extractCollaboratorsFromTitle('Canción [with Artista B]')).toEqual([
      'Artista B',
    ]);
  });

  it('extrae colaboradores fuera de paréntesis', () => {
    expect(
      extractCollaboratorsFromTitle('Canción ft. Artista B & Artista C')
    ).toEqual(['Artista B', 'Artista C']);
    expect(extractCollaboratorsFromTitle('A x B - Canción')).toEqual(['B']);
    expect(
      extractCollaboratorsFromTitle('Canción feat. Artista B - Official Video')
    ).toEqual(['Artista B']);
  });

  it('combina keywords fuera y dentro de paréntesis y deduplica', () => {
    expect(
      extractCollaboratorsFromTitle('Canción (feat. Artista A) ft. Artista A')
    ).toEqual(['Artista A']);
    expect(
      extractCollaboratorsFromTitle('Canción (feat. Artista A) y (ft. Artista B)')
    ).toEqual(['Artista A', 'Artista B']);
    expect(
      extractCollaboratorsFromTitle('Canción (feat. Artista A, Artista A)')
    ).toEqual(['Artista A']);
  });

  it('devuelve [] cuando el título no tiene colaboradores', () => {
    expect(extractCollaboratorsFromTitle('')).toEqual([]);
    expect(extractCollaboratorsFromTitle('(Official Audio)')).toEqual([]);
  });
});

describe('getTrackArtists', () => {
  it('une artistas estructurados y colaboradores del título sin duplicados', () => {
    const track = makeTrack({
      id: '1',
      title: 'Canción (feat. Artista B)',
      mainArtist: 'Artista A',
      allArtists: ['Artista A feat. Artista B'],
    });
    expect(getTrackArtists(track).map((a) => a.displayName)).toEqual([
      'Artista A',
      'Artista B',
    ]);
  });

  it('agrupa variantes de capitalización bajo la misma clave', () => {
    const track = makeTrack({
      id: '1',
      allArtists: ['ARTISTA A', 'artista a'],
      mainArtist: 'Artista A',
    });
    const artists = getTrackArtists(track);
    expect(artists).toHaveLength(1);
    expect(artists[0].key).toBe('artista a');
    expect(artists[0].displayName).toBe('ARTISTA A');
  });

  it('filtra el artista desconocido', () => {
    const track = makeTrack({
      id: '1',
      title: 'Canción',
      mainArtist: UNKNOWN_ARTIST,
      allArtists: [UNKNOWN_ARTIST],
    });
    expect(getTrackArtists(track)).toEqual([]);
  });

  it('combina artistas del título con los del extractor', () => {
    const track = makeTrack({
      id: '1',
      title: 'Canción (ft. Artista C)',
      mainArtist: 'Artista A',
      allArtists: ['Artista A, Artista B'],
    });
    expect(getTrackArtists(track).map((a) => a.displayName)).toEqual([
      'Artista A',
      'Artista B',
      'Artista C',
    ]);
  });
});

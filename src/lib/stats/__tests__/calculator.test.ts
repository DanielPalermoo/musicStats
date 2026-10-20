import { describe, expect, it } from 'vitest';

import { calculateMusicStats } from '@/lib/stats/calculator';
import { UNKNOWN_ARTIST } from '@/lib/stats/normalizer';
import type { ExtractedTrack } from '@/types/playlist';

function makeTrack(
  id: string,
  title: string,
  mainArtist: string,
  allArtists: string[],
  extra: Partial<ExtractedTrack> = {}
): ExtractedTrack {
  return { id, title, mainArtist, allArtists, ...extra };
}

describe('calculateMusicStats', () => {
  it('cuenta el total de pistas y de artistas únicos', () => {
    const stats = calculateMusicStats([
      makeTrack('1', 'T1', 'Alpha', ['Alpha']),
      makeTrack('2', 'T2', 'Beta', ['Beta', 'Alpha']),
      makeTrack('3', 'T3', 'Alpha', ['Alpha']),
    ]);

    expect(stats.totalTracks).toBe(3);
    expect(stats.totalArtists).toBe(2);
    expect(stats.artists.map((a) => a.name)).toEqual(['Alpha', 'Beta']);
  });

  it('determina el artista #1 con conteos y detalle de pistas', () => {
    const stats = calculateMusicStats([
      makeTrack('1', 'T1', 'Alpha', ['Alpha']),
      makeTrack('2', 'T2', 'Beta', ['Beta', 'Alpha']),
      makeTrack('3', 'T3', 'Alpha', ['Alpha']),
    ]);

    expect(stats.topArtist).not.toBeNull();
    expect(stats.topArtist?.key).toBe('alpha');
    expect(stats.topArtist?.appearanceCount).toBe(3);
    expect(stats.topArtist?.mainTrackCount).toBe(2);
    expect(stats.topArtist?.featuredTrackCount).toBe(1);
    expect(stats.topArtist?.tracks.map((t) => t.trackTitle)).toEqual([
      'T1',
      'T2',
      'T3',
    ]);
    expect(stats.topArtist?.tracks.map((t) => t.isMainArtist)).toEqual([
      true,
      false,
      true,
    ]);
  });

  it('usa la variante de nombre más frecuente para el artista #1', () => {
    const stats = calculateMusicStats([
      makeTrack('1', 'T1', 'Bad Bunny', ['Bad Bunny']),
      makeTrack('2', 'T2', 'Bad Bunny', ['Bad Bunny']),
      makeTrack('3', 'T3', 'bad bunny', ['bad bunny']),
    ]);

    expect(stats.topArtist?.name).toBe('Bad Bunny');
    expect(stats.topArtist?.key).toBe('bad bunny');
  });

  it('usa el primer artista de la lista cuando el principal no matchea', () => {
    const stats = calculateMusicStats([
      makeTrack('1', 'T', UNKNOWN_ARTIST, ['Alpha']),
    ]);

    expect(stats.topArtist?.key).toBe('alpha');
    expect(stats.topArtist?.mainTrackCount).toBe(1);
  });

  it('arma la matriz de colaboraciones con conteo, títulos y orden', () => {
    const stats = calculateMusicStats([
      makeTrack('1', 'Dúo', 'Alpha', ['Alpha', 'Beta']),
      makeTrack('2', 'Trío', 'Alpha', ['Alpha', 'Beta']),
      makeTrack('3', 'Sol', 'Gamma', ['Gamma', 'Beta']),
    ]);

    const alpha = stats.artists.find((a) => a.key === 'alpha');
    expect(alpha).toBeDefined();
    expect(alpha?.collaborations).toHaveLength(1);
    expect(alpha?.collaborations[0]).toEqual({
      artist: 'Beta',
      sharedTrackCount: 2,
      sharedTracks: ['Dúo', 'Trío'],
    });

    const beta = stats.artists.find((a) => a.key === 'beta');
    expect(beta).toBeDefined();
    // Orden: mayor cantidad de tracks compartidos primero.
    expect(beta?.collaborations.map((c) => c.artist)).toEqual([
      'Alpha',
      'Gamma',
    ]);
    expect(beta?.collaborations[0].sharedTrackCount).toBe(2);
    expect(beta?.collaborations[0].sharedTracks).toEqual(['Dúo', 'Trío']);
    expect(beta?.collaborations[1].sharedTrackCount).toBe(1);
    expect(beta?.collaborations[1].sharedTracks).toEqual(['Sol']);

    const gamma = stats.artists.find((a) => a.key === 'gamma');
    expect(gamma?.collaborations).toHaveLength(1);
    expect(gamma?.collaborations[0].artist).toBe('Beta');
  });

  it('registra colaboradores por aparición en tracks', () => {
    const stats = calculateMusicStats([
      makeTrack('1', 'Dúo', 'Alpha', ['Alpha', 'Beta']),
    ]);

    const alpha = stats.topArtist;
    expect(alpha?.tracks).toHaveLength(1);
    expect(alpha?.tracks[0]).toMatchObject({
      trackId: '1',
      trackTitle: 'Dúo',
      isMainArtist: true,
      collaborators: ['Beta'],
    });

    const beta = stats.artists.find((a) => a.key === 'beta');
    expect(beta?.tracks[0]).toMatchObject({
      isMainArtist: false,
      collaborators: ['Alpha'],
    });
  });

  it('selecciona hasta 3 tracks destacados: principal primero y sin repetir', () => {
    const stats = calculateMusicStats([
      // Aparece primero pero Alpha solo es colaborador.
      makeTrack('1', 'Colab Song', 'Otros', ['Otros', 'Alpha']),
      makeTrack('2', 'Main 1', 'Alpha', ['Alpha']),
      makeTrack('3', 'main 1 ', 'Alpha', ['Alpha']),
      makeTrack('4', 'Main 2', 'Alpha', ['Alpha']),
      makeTrack('5', 'Main 3', 'Alpha', ['Alpha']),
    ]);

    const top = stats.podium[0];
    expect(top.artist.key).toBe('alpha');
    expect(top.featuredTracks).toEqual(['Main 1', 'Main 2', 'Main 3']);
  });

  it('incluye colaboraciones en destacados cuando no hay temas principales', () => {
    const stats = calculateMusicStats([
      makeTrack('1', 'Único', 'Otros', ['Otros', 'Alpha']),
    ]);

    const alphaEntry = stats.podium.find((p) => p.artist.key === 'alpha');
    expect(alphaEntry).toBeDefined();
    expect(alphaEntry?.featuredTracks).toEqual(['Único']);
  });

  it('desempata por cantidad de temas como artista principal', () => {
    const stats = calculateMusicStats([
      makeTrack('1', 'T1', 'Alpha', ['Alpha', 'Beta']),
      makeTrack('2', 'T2', 'Alpha', ['Alpha', 'Beta']),
    ]);

    expect(stats.artists.map((a) => a.key)).toEqual(['alpha', 'beta']);
    expect(stats.artists[0].mainTrackCount).toBe(2);
    expect(stats.artists[1].mainTrackCount).toBe(0);
    expect(stats.artists.every((a) => a.appearanceCount === 2)).toBe(true);
  });

  it('desempata por índice de primera aparición', () => {
    const stats = calculateMusicStats([
      makeTrack('1', 'T1', 'Charlie', ['Charlie']),
      makeTrack('2', 'T2', 'Alpha', ['Alpha']),
      makeTrack('3', 'T3', 'Charlie', ['Charlie']),
      makeTrack('4', 'T4', 'Alpha', ['Alpha']),
    ]);

    // Mismas apariciones (2) y mismos temas principales (2): gana el que
    // aparece primero en la playlist.
    expect(stats.artists.map((a) => a.key)).toEqual(['charlie', 'alpha']);
  });

  it('desempata alfabéticamente (locale español) como último criterio', () => {
    const stats = calculateMusicStats([
      makeTrack('1', 'T1', 'Zeta', ['Zeta', 'Alpha']),
      makeTrack('2', 'T2', 'Alpha', ['Alpha', 'Zeta']),
    ]);

    // Ambos: 2 apariciones, 1 tema principal, primera aparición en la pista 1.
    expect(stats.artists.map((a) => a.key)).toEqual(['alpha', 'zeta']);
    expect(stats.artists[0].appearanceCount).toBe(2);
    expect(stats.artists[1].appearanceCount).toBe(2);
    expect(stats.artists[0].mainTrackCount).toBe(1);
    expect(stats.artists[1].mainTrackCount).toBe(1);
  });

  it('arma el podio Top 3 con ranks 1/2/3 y orden correcto', () => {
    const stats = calculateMusicStats([
      makeTrack('1', 'T1', 'Alpha', ['Alpha']),
      makeTrack('2', 'T2', 'Alpha', ['Alpha']),
      makeTrack('3', 'T3', 'Beta', ['Beta']),
      makeTrack('4', 'T4', 'Gamma', ['Gamma']),
      makeTrack('5', 'T5', 'Delta', ['Delta']),
    ]);

    expect(stats.podium).toHaveLength(3);
    expect(stats.podium.map((p) => p.rank)).toEqual([1, 2, 3]);
    expect(stats.podium.map((p) => p.artist.key)).toEqual([
      'alpha',
      'beta',
      'gamma',
    ]);
  });

  it('el podio tiene menos de 3 entradas si hay menos artistas', () => {
    const stats = calculateMusicStats([
      makeTrack('1', 'T1', 'Alpha', ['Alpha']),
      makeTrack('2', 'T2', 'Beta', ['Beta']),
    ]);

    expect(stats.podium).toHaveLength(2);
    expect(stats.podium.map((p) => p.rank)).toEqual([1, 2]);
  });

  it('toma la miniatura del podio desde thumbnailUrl o coverUrl', () => {
    const stats = calculateMusicStats([
      makeTrack('1', 'T1', 'Alpha', ['Alpha'], { thumbnailUrl: 'cover-alpha' }),
      makeTrack('2', 'T2', 'Beta', ['Beta'], { coverUrl: 'cover-beta' }),
    ]);

    expect(stats.podium[0].thumbnailUrl).toBe('cover-alpha');
    expect(stats.podium[1].thumbnailUrl).toBe('cover-beta');
  });

  it('devuelve stats vacías para una playlist sin pistas', () => {
    expect(calculateMusicStats([])).toEqual({
      totalTracks: 0,
      totalArtists: 0,
      topArtist: null,
      podium: [],
      artists: [],
    });
  });

  it('ignora pistas sin artistas válidos pero las cuenta en totalTracks', () => {
    const stats = calculateMusicStats([
      makeTrack('1', 'T', UNKNOWN_ARTIST, [UNKNOWN_ARTIST]),
    ]);

    expect(stats.totalTracks).toBe(1);
    expect(stats.totalArtists).toBe(0);
    expect(stats.topArtist).toBeNull();
    expect(stats.podium).toEqual([]);
    expect(stats.artists).toEqual([]);
  });
});

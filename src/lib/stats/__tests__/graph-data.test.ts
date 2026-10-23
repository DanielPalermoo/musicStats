import { describe, expect, it } from 'vitest';

import { calculateMusicStats } from '@/lib/stats/calculator';
import { generateCollaborationGraph } from '@/lib/stats/graph-data';
import type { ExtractedTrack } from '@/types/playlist';
import type { PlaylistStats } from '@/types/stats';

function makeTrack(
  id: string,
  title: string,
  mainArtist: string,
  allArtists: string[]
): ExtractedTrack {
  return { id, title, mainArtist, allArtists };
}

function statsFrom(tracks: ExtractedTrack[]): PlaylistStats {
  return calculateMusicStats(tracks);
}

describe('generateCollaborationGraph', () => {
  it('construye nodos con id, nombre, apariciones y bandera Top 3', () => {
    const stats = statsFrom([
      makeTrack('1', 'Dúo', 'Alpha', ['Alpha', 'Beta']),
      makeTrack('2', 'Trío', 'Alpha', ['Alpha', 'Beta']),
      makeTrack('3', 'Sol', 'Gamma', ['Gamma', 'Beta']),
    ]);

    const graph = generateCollaborationGraph(stats);

    expect(graph.nodes).toEqual([
      { id: 'beta', name: 'Beta', trackCount: 3, isTop3: true },
      { id: 'alpha', name: 'Alpha', trackCount: 2, isTop3: true },
      { id: 'gamma', name: 'Gamma', trackCount: 1, isTop3: true },
    ]);
  });

  it('crea una única arista mutua con peso y títulos compartidos', () => {
    const stats = statsFrom([
      makeTrack('1', 'Dúo', 'Alpha', ['Alpha', 'Beta']),
      makeTrack('2', 'Trío', 'Alpha', ['Alpha', 'Beta']),
      makeTrack('3', 'Sol', 'Gamma', ['Gamma', 'Beta']),
    ]);

    const graph = generateCollaborationGraph(stats);

    expect(graph.edges).toEqual([
      {
        source: 'beta',
        target: 'alpha',
        weight: 2,
        tracks: ['Dúo', 'Trío'],
      },
      {
        source: 'beta',
        target: 'gamma',
        weight: 1,
        tracks: ['Sol'],
      },
    ]);
  });

  it('orienta cada arista desde el artista mejor posicionado y no la duplica', () => {
    const stats = statsFrom([
      makeTrack('1', 'T1', 'Alpha', ['Alpha', 'Beta']),
      makeTrack('2', 'T2', 'Alpha', ['Alpha', 'Beta']),
      makeTrack('3', 'T3', 'Alpha', ['Alpha', 'Beta']),
    ]);

    const graph = generateCollaborationGraph(stats);

    expect(graph.edges).toHaveLength(1);
    // Alpha aparece 3 veces y Beta 3, pero Alpha es principal: va primero.
    expect(graph.edges[0]).toMatchObject({ source: 'alpha', target: 'beta', weight: 3 });
  });

  it('marca como Top 3 solo a los artistas del podio', () => {
    const stats = statsFrom([
      makeTrack('1', 'A1', 'Alpha', ['Alpha', 'Delta']),
      makeTrack('2', 'A2', 'Alpha', ['Alpha']),
      makeTrack('3', 'A3', 'Alpha', ['Alpha', 'Beta']),
      makeTrack('4', 'B1', 'Beta', ['Beta', 'Gamma']),
      makeTrack('5', 'C1', 'Gamma', ['Gamma', 'Delta']),
    ]);

    const graph = generateCollaborationGraph(stats);
    const top3 = graph.nodes.filter((node) => node.isTop3).map((node) => node.id);
    const delta = graph.nodes.find((node) => node.id === 'delta');

    expect(top3).toEqual(['alpha', 'beta', 'gamma']);
    expect(delta?.isTop3).toBe(false);
  });

  it('devuelve un grafo vacío cuando no hay colaboraciones', () => {
    const stats = statsFrom([
      makeTrack('1', 'T1', 'Alpha', ['Alpha']),
      makeTrack('2', 'T2', 'Beta', ['Beta']),
      makeTrack('3', 'T3', 'Gamma', ['Gamma']),
    ]);

    expect(generateCollaborationGraph(stats)).toEqual({ nodes: [], edges: [] });
  });

  it('puede incluir artistas aislados cuando se solicita', () => {
    const stats = statsFrom([
      makeTrack('1', 'T1', 'Alpha', ['Alpha']),
      makeTrack('2', 'T2', 'Beta', ['Beta']),
      makeTrack('3', 'T3', 'Gamma', ['Gamma']),
    ]);

    const graph = generateCollaborationGraph(stats, { includeIsolated: true });

    expect(graph.nodes.map((node) => node.id)).toEqual(['alpha', 'beta', 'gamma']);
    expect(graph.edges).toEqual([]);
  });

  it('limita los nodos a los artistas mejor posicionados y descarta aristas colgantes', () => {
    const stats = statsFrom([
      makeTrack('1', 'AB', 'Alpha', ['Alpha', 'Beta']),
      makeTrack('2', 'BC', 'Beta', ['Beta', 'Gamma']),
    ]);

    const graph = generateCollaborationGraph(stats, { maxNodes: 2 });

    // Orden por apariciones: Beta (2), Alpha (1), Gamma (1).
    expect(graph.nodes.map((node) => node.id)).toEqual(['beta', 'alpha']);
    expect(graph.edges).toEqual([
      { source: 'beta', target: 'alpha', weight: 1, tracks: ['AB'] },
    ]);
  });

  it('no limita la cantidad de nodos con maxNodes Infinity', () => {
    const stats = statsFrom([
      makeTrack('1', 'AB', 'Alpha', ['Alpha', 'Beta']),
      makeTrack('2', 'BC', 'Beta', ['Beta', 'Gamma']),
    ]);

    const graph = generateCollaborationGraph(stats, { maxNodes: Infinity });

    expect(graph.nodes).toHaveLength(3);
    expect(graph.edges).toHaveLength(2);
  });

  it('deduplica títulos repetidos sin alterar el peso de la arista', () => {
    const stats = statsFrom([
      makeTrack('1', 'Misma Canción', 'Alpha', ['Alpha', 'Beta']),
      makeTrack('2', 'Misma Canción', 'Alpha', ['Alpha', 'Beta']),
    ]);

    const graph = generateCollaborationGraph(stats);

    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0].weight).toBe(2);
    expect(graph.edges[0].tracks).toEqual(['Misma Canción']);
  });

  it('devuelve un grafo vacío para estadísticas sin artistas', () => {
    const stats: PlaylistStats = {
      totalTracks: 0,
      totalArtists: 0,
      topArtist: null,
      podium: [],
      artists: [],
    };

    expect(generateCollaborationGraph(stats)).toEqual({ nodes: [], edges: [] });
  });
});

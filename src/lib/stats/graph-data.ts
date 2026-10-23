/**
 * Generador de datos para el grafo de la red de colaboraciones.
 *
 * A partir de las estadísticas ya calculadas de una playlist se construyen:
 * - Nodos: un nodo por artista con su nombre, cantidad de canciones y si
 *   pertenece al podio Top 3.
 * - Aristas: una arista por cada relación de colaboración mutua, con el peso
 *   (cantidad de canciones compartidas) y los títulos compartidos.
 *
 * Las aristas se canonizan para que cada pareja aparezca una sola vez, sin
 * importar desde qué artista se haya descubierto la relación.
 */

import type { ArtistStats, PlaylistStats } from '@/types/stats';
import { normalizeArtistName } from './normalizer';

/** Cantidad máxima de nodos que se renderizan por defecto en playlists enormes. */
export const DEFAULT_MAX_GRAPH_NODES = 50;

/** Estrella del grafo: artista de la playlist. */
export interface GraphNode {
  /** Clave canónica del artista (misma que `ArtistStats.key`). */
  id: string;
  /** Nombre para mostrar. */
  name: string;
  /** Cantidad de canciones de la playlist en las que aparece. */
  trackCount: number;
  /** true si el artista pertenece al podio Top 3. */
  isTop3: boolean;
}

/** Conexión entre dos artistas que comparten al menos una canción. */
export interface GraphEdge {
  /** Id del nodo de origen (artista mejor posicionado de la pareja). */
  source: string;
  /** Id del nodo de destino. */
  target: string;
  /** Cantidad de canciones compartidas. */
  weight: number;
  /** Títulos de las canciones compartidas (sin duplicados). */
  tracks: string[];
}

/** Red completa lista para renderizar. */
export interface CollaborationGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/** Opciones de construcción del grafo. */
export interface GraphOptions {
  /**
   * Máximo de artistas a incluir (los mejor posicionados de la playlist).
   * Útil para mantener legible el grafo en playlists gigantescas. Por defecto
   * `DEFAULT_MAX_GRAPH_NODES`; usa `Infinity` para no limitar.
   */
  maxNodes?: number;
  /**
   * Incluir artistas sin ninguna colaboración (nodos aislados). Por defecto
   * `false`: el grafo muestra únicamente la red de colaboraciones.
   */
  includeIsolated?: boolean;
}

export type CollaborationGraphNode = GraphNode;
export type CollaborationGraphEdge = GraphEdge;
export type CollaborationGraphOptions = GraphOptions;

interface PendingEdge {
  source: string;
  target: string;
  weight: number;
  tracks: string[];
}

/** Quita títulos repetidos conservando el orden de aparición. */
function dedupeTracks(tracks: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const title of tracks) {
    const key = title.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(title);
  }
  return result;
}

/** Devuelve un límite de nodos válido (positivo) o `Infinity` si no hay límite. */
function resolveMaxNodes(maxNodes: number | undefined): number {
  if (maxNodes === undefined) return DEFAULT_MAX_GRAPH_NODES;
  if (!Number.isFinite(maxNodes)) return Infinity;
  return Math.max(1, Math.floor(maxNodes));
}

/**
 * Construye los nodos y las aristas de la red de colaboraciones de una
 * playlist.
 *
 * El orden de los nodos respeta el ranking de `stats.artists` (apariciones
 * descendente) y las aristas se ordenan por peso descendente para que las
 * conexiones más fuertes se dibujen primero.
 */
export function generateCollaborationGraph(
  stats: PlaylistStats,
  options: GraphOptions = {}
): CollaborationGraph {
  const artists = stats.artists ?? [];
  if (artists.length === 0) {
    return { nodes: [], edges: [] };
  }

  const includeIsolated = options.includeIsolated ?? false;
  const maxNodes = resolveMaxNodes(options.maxNodes);

  const artistByKey = new Map<string, ArtistStats>();
  const rankByKey = new Map<string, number>();
  artists.forEach((artist, index) => {
    artistByKey.set(artist.key, artist);
    rankByKey.set(artist.key, index);
  });

  const podium = stats.podium ?? [];
  const top3Keys = new Set(
    (podium.length > 0 ? podium.slice(0, 3).map((entry) => entry.artist.key) : artists.slice(0, 3).map((artist) => artist.key))
  );

  // 1. Recolectar una única arista por pareja de artistas. Se toma como
  //    fuente al artista mejor posicionado para que la orientación sea estable.
  const edgesByPair = new Map<string, PendingEdge>();
  for (const artist of artists) {
    for (const collaboration of artist.collaborations ?? []) {
      const normalized = normalizeArtistName(collaboration.artist);
      if (!normalized) continue;

      const other = artistByKey.get(normalized.key);
      if (!other || other.key === artist.key) continue;

      const artistRank = rankByKey.get(artist.key) ?? Number.MAX_SAFE_INTEGER;
      const otherRank = rankByKey.get(other.key) ?? Number.MAX_SAFE_INTEGER;
      const source = artistRank <= otherRank ? artist.key : other.key;
      const target = source === artist.key ? other.key : artist.key;
      const pairKey = `${source}\u0000${target}`;

      if (edgesByPair.has(pairKey)) continue;

      edgesByPair.set(pairKey, {
        source,
        target,
        weight: Math.max(1, collaboration.sharedTrackCount),
        tracks: dedupeTracks(collaboration.sharedTracks ?? []),
      });
    }
  }

  // 2. Determinar qué artistas forman parte de la red visible.
  const connectedKeys = new Set<string>();
  for (const edge of edgesByPair.values()) {
    connectedKeys.add(edge.source);
    connectedKeys.add(edge.target);
  }

  const candidateKeys = includeIsolated
    ? artists.map((artist) => artist.key)
    : artists.filter((artist) => connectedKeys.has(artist.key)).map((artist) => artist.key);

  const selectedKeys = new Set(candidateKeys.slice(0, maxNodes));

  const nodes: GraphNode[] = artists
    .filter((artist) => selectedKeys.has(artist.key))
    .map((artist) => ({
      id: artist.key,
      name: artist.name,
      trackCount: artist.appearanceCount,
      isTop3: top3Keys.has(artist.key),
    }));

  const edges: GraphEdge[] = [...edgesByPair.values()]
    .filter((edge) => selectedKeys.has(edge.source) && selectedKeys.has(edge.target))
    .map((edge) => ({ ...edge, tracks: [...edge.tracks] }))
    .sort((a, b) => {
      if (b.weight !== a.weight) return b.weight - a.weight;
      const aName = artistByKey.get(a.source)?.name ?? a.source;
      const bName = artistByKey.get(b.source)?.name ?? b.source;
      return aName.localeCompare(bName, 'es') || a.target.localeCompare(b.target, 'es');
    });

  return { nodes, edges };
}

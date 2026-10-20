/**
 * Tipos del motor de estadísticas y colaboraciones.
 */

/** Aparición de un artista en una canción, con el detalle de sus colaboradores en ese tema. */
export interface TrackAppearance {
  trackId: string;
  trackTitle: string;
  /** true si el artista es el artista principal de la canción. */
  isMainArtist: boolean;
  /** Otros artistas (normalizados) con los que comparte el tema, sin incluirse a sí mismo. */
  collaborators: string[];
}

/** Detalle de una colaboración: cuántas canciones en común tiene un artista con otro artista. */
export interface CollaborationInfo {
  /** Nombre para mostrar del artista colaborador. */
  artist: string;
  /** Cantidad de canciones compartidas. */
  sharedTrackCount: number;
  /** Títulos de las canciones compartidas. */
  sharedTracks: string[];
}

/** Estadísticas agregadas de un artista dentro de la playlist. */
export interface ArtistStats {
  /** Clave canónica de normalización (minúsculas, sin diacríticos) usada para agrupar. */
  key: string;
  /** Nombre para mostrar (la variante más frecuente, con su capitalización original). */
  name: string;
  /** Cantidad total de canciones de la playlist en las que aparece. */
  appearanceCount: number;
  /** Cantidad de canciones donde es el artista principal. */
  mainTrackCount: number;
  /** Cantidad de canciones donde aparece únicamente como colaborador. */
  featuredTrackCount: number;
  /** Canciones en las que participa, con el detalle de colaboradores por canción. */
  tracks: TrackAppearance[];
  /** Matriz de colaboradores: otros artistas con los que comparte temas, ordenada por frecuencia. */
  collaborations: CollaborationInfo[];
}

/** Entrada del podio Top 3 de artistas. */
export interface PodiumEntry {
  /** Posición en el podio: 1 (oro), 2 (plata) o 3 (bronce). */
  rank: 1 | 2 | 3;
  artist: ArtistStats;
  /**
   * Hasta 3 canciones destacadas del artista para el popover del podio.
   * Se priorizan sus temas como artista principal y luego sus colaboraciones.
   */
  featuredTracks: string[];
  /** Miniatura/portada tomada de alguna de las canciones donde aparece el artista. */
  thumbnailUrl?: string;
}

/** Resultado completo del motor de estadísticas de una playlist. */
export interface PlaylistStats {
  /** Total de pistas analizadas. */
  totalTracks: number;
  /** Total de artistas únicos (normalizados). */
  totalArtists: number;
  /** Artista #1 (el de mayor cantidad de apariciones), o null si no hay artistas válidos. */
  topArtist: ArtistStats | null;
  /** Podio Top 3 (puede tener menos de 3 entradas si la playlist tiene menos artistas). */
  podium: PodiumEntry[];
  /** Todos los artistas ordenados por apariciones (descendente) y luego alfabéticamente. */
  artists: ArtistStats[];
}

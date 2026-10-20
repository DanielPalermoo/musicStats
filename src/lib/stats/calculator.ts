/**
 * Calculador estadístico de playlists.
 *
 * calculateMusicStats recorre las pistas extraídas, cuenta apariciones por
 * artista normalizado, determina el artista más frecuente (#1) con el detalle
 * de sus canciones y colaboradores, y arma el podio Top 3 (con desempate
 * alfabético).
 */

import type { ExtractedTrack } from '@/types/playlist';
import type {
  ArtistStats,
  CollaborationInfo,
  PlaylistStats,
  PodiumEntry,
  TrackAppearance,
} from '@/types/stats';
import { getTrackArtists, normalizeArtistName } from './normalizer';

const PODIUM_SIZE = 3;

interface CollaborationAccumulator {
  key: string;
  nameCounts: Map<string, number>;
  sharedTracks: string[];
}

interface ArtistAccumulator {
  key: string;
  nameCounts: Map<string, number>;
  appearanceCount: number;
  mainTrackCount: number;
  featuredTrackCount: number;
  tracks: TrackAppearance[];
  collaborations: Map<string, CollaborationAccumulator>;
}

/** Elige el nombre más frecuente entre las variantes vistas (para el display). */
function pickFrequentName(nameCounts: Map<string, number>, fallback: string): string {
  let best = fallback;
  let bestCount = -1;
  for (const [name, count] of nameCounts) {
    if (count > bestCount) {
      best = name;
      bestCount = count;
    }
  }
  return best;
}

function bumpNameCount(nameCounts: Map<string, number>, name: string): void {
  nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
}

/**
 * Calcula las estadísticas completas de una playlist a partir de sus pistas.
 */
export function calculateMusicStats(tracks: ExtractedTrack[]): PlaylistStats {
  const artists = new Map<string, ArtistAccumulator>();

  function touchArtist(key: string, displayName: string): ArtistAccumulator {
    let acc = artists.get(key);
    if (!acc) {
      acc = {
        key,
        nameCounts: new Map(),
        appearanceCount: 0,
        mainTrackCount: 0,
        featuredTrackCount: 0,
        tracks: [],
        collaborations: new Map(),
      };
      artists.set(key, acc);
    }
    bumpNameCount(acc.nameCounts, displayName);
    return acc;
  }

  for (const track of tracks) {
    const trackArtists = getTrackArtists(track);
    if (trackArtists.length === 0) continue;

    // El artista principal es el indicado por el extractor; si no matchea,
    // se toma el primero de la lista por convención del extractor.
    const mainNormalized = normalizeArtistName(track.mainArtist);
    const mainKey =
      mainNormalized && trackArtists.some((a) => a.key === mainNormalized.key)
        ? mainNormalized.key
        : trackArtists[0].key;

    for (const artist of trackArtists) {
      const acc = touchArtist(artist.key, artist.displayName);
      acc.appearanceCount += 1;

      const isMainArtist = artist.key === mainKey;
      if (isMainArtist) {
        acc.mainTrackCount += 1;
      } else {
        acc.featuredTrackCount += 1;
      }

      acc.tracks.push({
        trackId: track.id,
        trackTitle: track.title,
        isMainArtist,
        collaborators: trackArtists
          .filter((other) => other.key !== artist.key)
          .map((other) => other.displayName),
      });

      // Matriz de colaboradores: registra cada co-aparición con otro artista del tema.
      for (const other of trackArtists) {
        if (other.key === artist.key) continue;
        let collab = acc.collaborations.get(other.key);
        if (!collab) {
          collab = { key: other.key, nameCounts: new Map(), sharedTracks: [] };
          acc.collaborations.set(other.key, collab);
        }
        bumpNameCount(collab.nameCounts, other.displayName);
        collab.sharedTracks.push(track.title);
      }
    }
  }

  const artistStats: ArtistStats[] = [...artists.values()]
    .map((acc): ArtistStats => {
      const collaborations: CollaborationInfo[] = [...acc.collaborations.values()]
        .map((collab): CollaborationInfo => {
          const name = pickFrequentName(collab.nameCounts, collab.sharedTracks[0] ?? collab.key);
          return {
            artist: name,
            sharedTrackCount: collab.sharedTracks.length,
            sharedTracks: collab.sharedTracks,
          };
        })
        .sort(
          (a, b) =>
            b.sharedTrackCount - a.sharedTrackCount || a.artist.localeCompare(b.artist, 'es')
        );

      const name = pickFrequentName(acc.nameCounts, acc.key);
      return {
        key: acc.key,
        name,
        appearanceCount: acc.appearanceCount,
        mainTrackCount: acc.mainTrackCount,
        featuredTrackCount: acc.featuredTrackCount,
        tracks: acc.tracks,
        collaborations,
      };
    })
    .sort(
      (a, b) =>
        b.appearanceCount - a.appearanceCount || a.name.localeCompare(b.name, 'es')
    );

  const topArtist = artistStats[0] ?? null;
  const podium: PodiumEntry[] = artistStats.slice(0, PODIUM_SIZE).map((artist, idx) => ({
    rank: (idx + 1) as PodiumEntry['rank'],
    artist,
  }));

  return {
    totalTracks: tracks.length,
    totalArtists: artistStats.length,
    topArtist,
    podium,
    artists: artistStats,
  };
}

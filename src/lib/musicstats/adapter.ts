import type { PlaylistStats } from '@/types/stats'
import type { ExtractedTrack, PlatformType } from '@/types/playlist'
import type { ArtistStat, CollabEdge, PlatformId, PlaylistAnalysis, Track } from './types'

export interface RawAnalyzeResponse {
  platform: PlatformType | PlatformId
  playlistId: string
  playlistTitle: string
  totalTracks: number
  stats: PlaylistStats
  tracks: ExtractedTrack[]
}

export function normalizePlatform(platform: PlatformType | PlatformId | string): PlatformId {
  if (platform === 'youtube_music' || platform === 'youtube') return 'youtube'
  if (platform === 'spotify') return 'spotify'
  if (platform === 'deezer') return 'deezer'
  if (platform === 'soundcloud') return 'soundcloud'
  if (platform === 'tidal') return 'tidal'
  return 'youtube'
}

export function parseDurationToSeconds(
  durationMs?: number,
  durationText?: string,
  fallback = 0
): number {
  if (typeof durationMs === 'number' && durationMs > 0) {
    return Math.round(durationMs / 1000)
  }

  if (typeof durationText === 'string' && durationText.trim()) {
    const parts = durationText.trim().split(':').map((p) => parseInt(p, 10))
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return parts[0] * 60 + parts[1]
    }
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2]
    }
  }

  return fallback
}

export function adaptAnalyzeResponse(
  raw: RawAnalyzeResponse,
  options?: { url?: string; owner?: string }
): PlaylistAnalysis {
  const platform = normalizePlatform(raw.platform)

  // 1. Transform tracks to v0 format
  const tracks: Track[] = (raw.tracks || []).map((t, idx) => {
    const artists =
      Array.isArray(t.allArtists) && t.allArtists.length > 0
        ? t.allArtists
        : t.mainArtist
          ? [t.mainArtist]
          : ['Desconocido']

    const duration = parseDurationToSeconds(t.durationMs, t.durationText, 180)
    const coverUrl = t.coverUrl || t.thumbnailUrl

    return {
      id: t.id || `t${idx + 1}`,
      title: t.title || `Pista ${idx + 1}`,
      artists,
      duration,
      coverUrl,
    }
  })

  // Map each track id to its artists and track object for quick lookup
  const trackMap = new Map<string, Track>()
  const trackArtistsMap = new Map<string, string[]>()
  for (const track of tracks) {
    trackMap.set(track.id, track)
    trackArtistsMap.set(track.id, track.artists)
  }

  // Helper to derive artist imageUrl prioritizing tracks where they are main artist
  const getArtistImage = (artistName: string, artistTrackIds: string[]): string | undefined => {
    const lowerName = artistName.toLowerCase().trim()

    // 1. Try tracks where this artist is main artist (artists[0]) and has a coverUrl
    for (const tid of artistTrackIds) {
      const track = trackMap.get(tid)
      if (track?.coverUrl && track.artists[0]?.toLowerCase().trim() === lowerName) {
        return track.coverUrl
      }
    }

    // 2. Try any track where artist appears that has a coverUrl
    for (const tid of artistTrackIds) {
      const track = trackMap.get(tid)
      if (track?.coverUrl) {
        return track.coverUrl
      }
    }

    return undefined
  }

  // 2. Build CollabEdge map from tracks
  const edgeMap = new Map<string, CollabEdge>()
  for (const track of tracks) {
    const artists = track.artists
    for (let i = 0; i < artists.length; i++) {
      for (let j = i + 1; j < artists.length; j++) {
        const [a, b] = [artists[i], artists[j]].sort()
        if (a === b) continue
        const key = `${a}__${b}`
        const edge = edgeMap.get(key) ?? { source: a, target: b, trackIds: [] }
        if (!edge.trackIds.includes(track.id)) {
          edge.trackIds.push(track.id)
        }
        edgeMap.set(key, edge)
      }
    }
  }

  // 3. Build artists list: prefer backend stats if present, or infer from tracks
  let artists: ArtistStat[] = []

  if (raw.stats && Array.isArray(raw.stats.artists) && raw.stats.artists.length > 0) {
    artists = raw.stats.artists.map((artist, index) => {
      const trackIds = Array.isArray(artist.tracks)
        ? artist.tracks.map((t) => t.trackId)
        : []

      const collaborators = (artist.collaborations || []).map((collab) => {
        // Find trackIds that share this collaboration
        const sharedTrackIds: string[] = []
        for (const tid of trackIds) {
          const trackArtists = trackArtistsMap.get(tid)
          if (
            trackArtists &&
            trackArtists.some(
              (a) => a.toLowerCase().trim() === collab.artist.toLowerCase().trim()
            )
          ) {
            sharedTrackIds.push(tid)
          }
        }

        return {
          name: collab.artist,
          trackIds: sharedTrackIds.length > 0 ? sharedTrackIds : trackIds.slice(0, collab.sharedTrackCount),
        }
      })

      return {
        name: artist.name,
        rank: index + 1,
        count: artist.appearanceCount,
        mainCount: artist.mainTrackCount,
        featCount: artist.featuredTrackCount,
        trackIds,
        collaborators,
        imageUrl: getArtistImage(artist.name, trackIds),
      }
    })
  } else {
    // Fallback if stats is empty: compute stats from tracks
    const artistMap = new Map<
      string,
      {
        count: number
        mainCount: number
        featCount: number
        trackIds: string[]
        collabMap: Map<string, string[]>
      }
    >()

    for (const track of tracks) {
      track.artists.forEach((name, i) => {
        let entry = artistMap.get(name)
        if (!entry) {
          entry = {
            count: 0,
            mainCount: 0,
            featCount: 0,
            trackIds: [],
            collabMap: new Map(),
          }
          artistMap.set(name, entry)
        }
        entry.count++
        if (i === 0) entry.mainCount++
        else entry.featCount++
        entry.trackIds.push(track.id)

        for (const other of track.artists) {
          if (other === name) continue
          const list = entry.collabMap.get(other) ?? []
          list.push(track.id)
          entry.collabMap.set(other, list)
        }
      })
    }

    artists = [...artistMap.entries()]
      .sort(
        (a, b) =>
          b[1].count - a[1].count ||
          b[1].mainCount - a[1].mainCount ||
          a[0].localeCompare(b[0])
      )
      .map(([name, data], idx) => ({
        name,
        rank: idx + 1,
        count: data.count,
        mainCount: data.mainCount,
        featCount: data.featCount,
        trackIds: data.trackIds,
        collaborators: [...data.collabMap.entries()]
          .map(([cName, cIds]) => ({ name: cName, trackIds: cIds }))
          .sort((a, b) => b.trackIds.length - a.trackIds.length || a.name.localeCompare(b.name)),
        imageUrl: getArtistImage(name, data.trackIds),
      }))
  }

  const totalTracks = tracks.length
  const uniqueArtists = artists.length
  const totalDuration = tracks.reduce((sum, t) => sum + (t.duration || 0), 0)

  const defaultOwner =
    platform === 'spotify'
      ? 'Spotify'
      : platform === 'youtube'
        ? 'YouTube Music'
        : platform === 'deezer'
          ? 'Deezer'
          : platform === 'soundcloud'
            ? 'SoundCloud'
            : 'Tidal'

  return {
    playlist: {
      title: raw.playlistTitle || 'Playlist',
      owner: options?.owner || defaultOwner,
      url: options?.url || '',
      platform,
      totalDuration,
    },
    tracks,
    artists,
    edges: [...edgeMap.values()],
    stats: {
      totalTracks,
      uniqueArtists,
      diversity: totalTracks ? Math.round((uniqueArtists / totalTracks) * 100) : 0,
      avgPerArtist: uniqueArtists ? Number((totalTracks / uniqueArtists).toFixed(1)) : 0,
      collabTracks: tracks.filter((t) => t.artists.length > 1).length,
    },
  }
}

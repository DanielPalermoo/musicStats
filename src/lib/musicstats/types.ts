export type PlatformId = 'youtube' | 'spotify' | 'deezer' | 'soundcloud'

export type Track = {
  id: string
  title: string
  artists: string[]
  duration: number
}

export type Collaborator = {
  name: string
  trackIds: string[]
}

export type ArtistStat = {
  name: string
  rank: number
  count: number
  mainCount: number
  featCount: number
  trackIds: string[]
  collaborators: Collaborator[]
}

export type CollabEdge = {
  source: string
  target: string
  trackIds: string[]
}

export type PlaylistAnalysis = {
  playlist: {
    title: string
    owner: string
    url: string
    platform: PlatformId
    totalDuration: number
  }
  tracks: Track[]
  artists: ArtistStat[]
  edges: CollabEdge[]
  stats: {
    totalTracks: number
    uniqueArtists: number
    diversity: number
    avgPerArtist: number
    collabTracks: number
  }
}

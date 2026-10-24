import { describe, expect, it } from 'vitest'
import {
  adaptAnalyzeResponse,
  normalizePlatform,
  parseDurationToSeconds,
  type RawAnalyzeResponse,
} from '../adapter'
import type { PlaylistStats } from '@/types/stats'
import type { ExtractedTrack } from '@/types/playlist'

describe('MusicStats Adapter', () => {
  describe('normalizePlatform', () => {
    it('normaliza youtube_music a youtube', () => {
      expect(normalizePlatform('youtube_music')).toBe('youtube')
      expect(normalizePlatform('youtube')).toBe('youtube')
    })

    it('respeta spotify, deezer y soundcloud', () => {
      expect(normalizePlatform('spotify')).toBe('spotify')
      expect(normalizePlatform('deezer')).toBe('deezer')
      expect(normalizePlatform('soundcloud')).toBe('soundcloud')
    })

    it('asigna youtube por defecto ante plataforma desconocida', () => {
      expect(normalizePlatform('unknown')).toBe('youtube')
    })
  })

  describe('parseDurationToSeconds', () => {
    it('convierte durationMs a segundos', () => {
      expect(parseDurationToSeconds(184000)).toBe(184)
      expect(parseDurationToSeconds(210500)).toBe(211)
    })

    it('convierte durationText "m:ss" y "h:mm:ss" a segundos', () => {
      expect(parseDurationToSeconds(undefined, '3:20')).toBe(200)
      expect(parseDurationToSeconds(undefined, '1:02:15')).toBe(3735)
    })

    it('devuelve el valor fallback si no hay datos de duración válidos', () => {
      expect(parseDurationToSeconds(undefined, undefined, 180)).toBe(180)
      expect(parseDurationToSeconds(0, '', 120)).toBe(120)
    })
  })

  describe('adaptAnalyzeResponse', () => {
    const mockTracks: ExtractedTrack[] = [
      {
        id: 't1',
        title: 'Song 1',
        mainArtist: 'Bad Bunny',
        allArtists: ['Bad Bunny', 'Feid'],
        durationMs: 200000,
      },
      {
        id: 't2',
        title: 'Song 2',
        mainArtist: 'Feid',
        allArtists: ['Feid', 'Young Miko'],
        durationMs: 180000,
      },
      {
        id: 't3',
        title: 'Song 3',
        mainArtist: 'Bad Bunny',
        allArtists: ['Bad Bunny'],
        durationMs: 220000,
      },
    ]

    const mockStats: PlaylistStats = {
      totalTracks: 3,
      totalArtists: 3,
      topArtist: {
        key: 'bad bunny',
        name: 'Bad Bunny',
        appearanceCount: 2,
        mainTrackCount: 2,
        featuredTrackCount: 0,
        tracks: [
          { trackId: 't1', trackTitle: 'Song 1', isMainArtist: true, collaborators: ['Feid'] },
          { trackId: 't3', trackTitle: 'Song 3', isMainArtist: true, collaborators: [] },
        ],
        collaborations: [{ artist: 'Feid', sharedTrackCount: 1, sharedTracks: ['Song 1'] }],
      },
      podium: [
        {
          rank: 1,
          artist: {
            key: 'bad bunny',
            name: 'Bad Bunny',
            appearanceCount: 2,
            mainTrackCount: 2,
            featuredTrackCount: 0,
            tracks: [
              { trackId: 't1', trackTitle: 'Song 1', isMainArtist: true, collaborators: ['Feid'] },
              { trackId: 't3', trackTitle: 'Song 3', isMainArtist: true, collaborators: [] },
            ],
            collaborations: [{ artist: 'Feid', sharedTrackCount: 1, sharedTracks: ['Song 1'] }],
          },
          featuredTracks: ['Song 1', 'Song 3'],
        },
        {
          rank: 2,
          artist: {
            key: 'feid',
            name: 'Feid',
            appearanceCount: 2,
            mainTrackCount: 1,
            featuredTrackCount: 1,
            tracks: [
              { trackId: 't1', trackTitle: 'Song 1', isMainArtist: false, collaborators: ['Bad Bunny'] },
              { trackId: 't2', trackTitle: 'Song 2', isMainArtist: true, collaborators: ['Young Miko'] },
            ],
            collaborations: [
              { artist: 'Bad Bunny', sharedTrackCount: 1, sharedTracks: ['Song 1'] },
              { artist: 'Young Miko', sharedTrackCount: 1, sharedTracks: ['Song 2'] },
            ],
          },
          featuredTracks: ['Song 2', 'Song 1'],
        },
        {
          rank: 3,
          artist: {
            key: 'young miko',
            name: 'Young Miko',
            appearanceCount: 1,
            mainTrackCount: 0,
            featuredTrackCount: 1,
            tracks: [
              { trackId: 't2', trackTitle: 'Song 2', isMainArtist: false, collaborators: ['Feid'] },
            ],
            collaborations: [{ artist: 'Feid', sharedTrackCount: 1, sharedTracks: ['Song 2'] }],
          },
          featuredTracks: ['Song 2'],
        },
      ],
      artists: [
        {
          key: 'bad bunny',
          name: 'Bad Bunny',
          appearanceCount: 2,
          mainTrackCount: 2,
          featuredTrackCount: 0,
          tracks: [
            { trackId: 't1', trackTitle: 'Song 1', isMainArtist: true, collaborators: ['Feid'] },
            { trackId: 't3', trackTitle: 'Song 3', isMainArtist: true, collaborators: [] },
          ],
          collaborations: [{ artist: 'Feid', sharedTrackCount: 1, sharedTracks: ['Song 1'] }],
        },
        {
          key: 'feid',
          name: 'Feid',
          appearanceCount: 2,
          mainTrackCount: 1,
          featuredTrackCount: 1,
          tracks: [
            { trackId: 't1', trackTitle: 'Song 1', isMainArtist: false, collaborators: ['Bad Bunny'] },
            { trackId: 't2', trackTitle: 'Song 2', isMainArtist: true, collaborators: ['Young Miko'] },
          ],
          collaborations: [
            { artist: 'Bad Bunny', sharedTrackCount: 1, sharedTracks: ['Song 1'] },
            { artist: 'Young Miko', sharedTrackCount: 1, sharedTracks: ['Song 2'] },
          ],
        },
        {
          key: 'young miko',
          name: 'Young Miko',
          appearanceCount: 1,
          mainTrackCount: 0,
          featuredTrackCount: 1,
          tracks: [
            { trackId: 't2', trackTitle: 'Song 2', isMainArtist: false, collaborators: ['Feid'] },
          ],
          collaborations: [{ artist: 'Feid', sharedTrackCount: 1, sharedTracks: ['Song 2'] }],
        },
      ],
    }

    const rawResponse: RawAnalyzeResponse = {
      platform: 'youtube_music',
      playlistId: 'PL123',
      playlistTitle: 'Trap Latino 2026',
      totalTracks: 3,
      stats: mockStats,
      tracks: mockTracks,
    }

    it('transforma la respuesta cruda de /api/analyze al formato PlaylistAnalysis', () => {
      const result = adaptAnalyzeResponse(rawResponse, { url: 'https://music.youtube.com/playlist?list=PL123' })

      // Playlist metadata
      expect(result.playlist.title).toBe('Trap Latino 2026')
      expect(result.playlist.platform).toBe('youtube')
      expect(result.playlist.url).toBe('https://music.youtube.com/playlist?list=PL123')
      expect(result.playlist.totalDuration).toBe(200 + 180 + 220)

      // Tracks
      expect(result.tracks).toHaveLength(3)
      expect(result.tracks[0]).toEqual({
        id: 't1',
        title: 'Song 1',
        artists: ['Bad Bunny', 'Feid'],
        duration: 200,
      })

      // Artists
      expect(result.artists).toHaveLength(3)
      expect(result.artists[0].name).toBe('Bad Bunny')
      expect(result.artists[0].rank).toBe(1)
      expect(result.artists[0].count).toBe(2)
      expect(result.artists[0].mainCount).toBe(2)
      expect(result.artists[0].trackIds).toEqual(['t1', 't3'])
      expect(result.artists[0].collaborators).toEqual([
        { name: 'Feid', trackIds: ['t1'] },
      ])

      // Collab edges
      expect(result.edges).toHaveLength(2)
      const edgeFeidMiko = result.edges.find((e) => e.source === 'Feid' && e.target === 'Young Miko')
      expect(edgeFeidMiko).toBeDefined()
      expect(edgeFeidMiko?.trackIds).toEqual(['t2'])

      // Stats
      expect(result.stats.totalTracks).toBe(3)
      expect(result.stats.uniqueArtists).toBe(3)
      expect(result.stats.diversity).toBe(100)
      expect(result.stats.collabTracks).toBe(2)
    })

    it('calcula estadísticas directamente a partir de tracks cuando stats está vacío', () => {
      const emptyStatsResponse: RawAnalyzeResponse = {
        platform: 'spotify',
        playlistId: 'sp1',
        playlistTitle: 'Spotify Top',
        totalTracks: 2,
        stats: {
          totalTracks: 0,
          totalArtists: 0,
          topArtist: null,
          podium: [],
          artists: [],
        },
        tracks: [
          { id: '1', title: 'Solo', mainArtist: 'Shakira', allArtists: ['Shakira'], durationMs: 180000 },
          { id: '2', title: 'Collab', mainArtist: 'Shakira', allArtists: ['Shakira', 'Bizarrap'], durationMs: 210000 },
        ],
      }

      const result = adaptAnalyzeResponse(emptyStatsResponse)
      expect(result.artists).toHaveLength(2)
      expect(result.artists[0].name).toBe('Shakira')
      expect(result.artists[0].count).toBe(2)
      expect(result.artists[0].collaborators).toEqual([{ name: 'Bizarrap', trackIds: ['2'] }])
      expect(result.stats.collabTracks).toBe(1)
    })
  })
})

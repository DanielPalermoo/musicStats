import type { PlatformId } from './types'

export type PlatformConfig = {
  id: PlatformId
  name: string
  color: string
  hosts: string[]
  example: string
}

export const PLATFORMS: PlatformConfig[] = [
  {
    id: 'youtube',
    name: 'YouTube Music',
    color: '#ff4e45',
    hosts: ['music.youtube.com', 'youtube.com', 'www.youtube.com', 'youtu.be', 'm.youtube.com'],
    example: 'https://music.youtube.com/playlist?list=PLxA687tYuMWh',
  },
  {
    id: 'spotify',
    name: 'Spotify',
    color: '#10b981',
    hosts: ['open.spotify.com', 'spotify.com', 'spotify.link'],
    example: 'https://open.spotify.com/playlist/37i9dQZF1DX10zKzsJ2jva',
  },
  {
    id: 'deezer',
    name: 'Deezer',
    color: '#a855f7',
    hosts: ['deezer.com', 'www.deezer.com', 'deezer.page.link', 'link.deezer.com'],
    example: 'https://www.deezer.com/es/playlist/1283499335',
  },
  {
    id: 'soundcloud',
    name: 'SoundCloud',
    color: '#f97316',
    hosts: ['soundcloud.com', 'www.soundcloud.com', 'on.soundcloud.com', 'm.soundcloud.com'],
    example: 'https://soundcloud.com/musicstats/sets/latin-heat',
  },
]

export const PLATFORM_MAP = Object.fromEntries(PLATFORMS.map((p) => [p.id, p])) as Record<
  PlatformId,
  PlatformConfig
>

export function detectPlatform(raw: string): PlatformId | null {
  try {
    const url = new URL(raw.trim())
    const host = url.hostname.toLowerCase()
    const match = PLATFORMS.find((p) => p.hosts.some((h) => host === h || host.endsWith(`.${h}`)))
    return match?.id ?? null
  } catch {
    return null
  }
}

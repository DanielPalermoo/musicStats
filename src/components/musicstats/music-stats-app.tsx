'use client'

import { useCallback, useEffect, useState } from 'react'
import useSWR from 'swr'
import { detectPlatform } from '@/lib/musicstats/platforms'
import type { PlatformId, PlaylistAnalysis } from '@/lib/musicstats/types'
import { adaptAnalyzeResponse } from '@/lib/musicstats/adapter'
import { AnalysisProvider } from './analysis-context'
import { ArtistSheet } from './artist-sheet'
import { CollabGraph } from './collab-graph'
import { DashboardSkeleton } from './dashboard-skeleton'
import { OtherArtistsPanel, TracklistPanel } from './exploration-panels'
import { MetricCards } from './metric-cards'
import { Podium } from './podium'
import { ResultsHeader } from './results-header'
import { SearchHero } from './search-hero'
import { SiteHeader } from './site-header'
import { StoryCardDialog } from './story-card-dialog'
import { TopArtistCard } from './top-artist-card'

async function fetcher(endpoint: string): Promise<PlaylistAnalysis> {
  const parsed = new URL(endpoint, window.location.origin)
  const playlistUrl = parsed.searchParams.get('url') ?? ''

  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: playlistUrl }),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? 'No se pudo analizar la playlist.')
  return adaptAnalyzeResponse(body, { url: playlistUrl })
}

export function MusicStatsApp({ initialUrl }: { initialUrl?: string }) {
  const [platform, setPlatform] = useState<PlatformId>(() => (initialUrl && detectPlatform(initialUrl)) || 'youtube')
  const [playlistUrl, setPlaylistUrl] = useState<string | null>(initialUrl ?? null)
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null)
  const [storyOpen, setStoryOpen] = useState(false)

  const { data, error, isLoading } = useSWR(
    playlistUrl ? `/api/analyze?url=${encodeURIComponent(playlistUrl)}` : null,
    fetcher,
    { revalidateOnFocus: false, shouldRetryOnError: false },
  )

  useEffect(() => {
    if (data) document.getElementById('results')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [data])

  const openArtist = useCallback((name: string) => setSelectedArtist(name), [])

  const reset = () => {
    setPlaylistUrl(null)
    setSelectedArtist(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const hasResults = Boolean(data) && !isLoading

  return (
    <div className="relative min-h-dvh overflow-x-clip">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          backgroundImage:
            'radial-gradient(60% 40% at 50% -10%, rgb(16 185 129 / 0.08), transparent), radial-gradient(40% 30% at 100% 30%, rgb(245 158 11 / 0.04), transparent)',
        }}
      />
      <SiteHeader onHome={reset} />

      <main className="mx-auto max-w-7xl px-4 pb-20 md:px-6">
        <SearchHero
          platform={platform}
          onPlatformChange={setPlatform}
          onSubmit={setPlaylistUrl}
          loading={isLoading}
          error={error?.message}
          compact={Boolean(playlistUrl) && !error}
        />

        <div id="results" className="scroll-mt-20">
          {isLoading && <DashboardSkeleton />}

          {hasResults && data && (
            <AnalysisProvider analysis={data} openArtist={openArtist}>
              <div className="flex flex-col gap-4">
                <ResultsHeader onDownload={() => setStoryOpen(true)} />
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                  <MetricCards />
                  <TopArtistCard />
                </div>
                <Podium />
                <CollabGraph />
                <div className="grid gap-4 lg:grid-cols-2">
                  <TracklistPanel />
                  <OtherArtistsPanel />
                </div>
              </div>
              <ArtistSheet name={selectedArtist} onClose={() => setSelectedArtist(null)} />
              <StoryCardDialog open={storyOpen} onOpenChange={setStoryOpen} />
            </AnalysisProvider>
          )}
        </div>
      </main>

      <footer className="border-t border-white/5 py-8 text-center text-xs text-muted-foreground">
        <p>MusicStats · Compatible con YouTube Music, Spotify, Deezer, SoundCloud y Tidal.</p>
      </footer>
    </div>
  )
}

'use client'

import { createContext, useContext, useMemo } from 'react'
import type { ArtistStat, PlaylistAnalysis, Track } from '@/lib/musicstats/types'

type AnalysisContextValue = {
  analysis: PlaylistAnalysis
  trackById: Map<string, Track>
  artistByName: Map<string, ArtistStat>
  openArtist: (name: string) => void
}

const AnalysisContext = createContext<AnalysisContextValue | null>(null)

export function AnalysisProvider({
  analysis,
  openArtist,
  children,
}: {
  analysis: PlaylistAnalysis
  openArtist: (name: string) => void
  children: React.ReactNode
}) {
  const value = useMemo(
    () => ({
      analysis,
      openArtist,
      trackById: new Map(analysis.tracks.map((t) => [t.id, t])),
      artistByName: new Map(analysis.artists.map((a) => [a.name, a])),
    }),
    [analysis, openArtist],
  )
  return <AnalysisContext.Provider value={value}>{children}</AnalysisContext.Provider>
}

export function useAnalysis() {
  const ctx = useContext(AnalysisContext)
  if (!ctx) throw new Error('useAnalysis must be used inside AnalysisProvider')
  return ctx
}

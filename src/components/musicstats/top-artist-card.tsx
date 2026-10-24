'use client'

import { useState } from 'react'
import { ChevronDown, Crown, Mic2, UsersRound } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAnalysis } from './analysis-context'
import { ArtistAvatar, CoverArt, EqualizerBars } from './artwork'
import { TracksHoverCard } from './shared'

export function TopArtistCard() {
  const { analysis, trackById, openArtist } = useAnalysis()
  const [showCollabs, setShowCollabs] = useState(true)
  const top = analysis.artists[0]
  if (!top) return null

  const share = Math.round((top.count / analysis.stats.totalTracks) * 100)
  const mainPct = Math.round((top.mainCount / top.count) * 100)
  const featured = top.trackIds.slice(0, 4).map((id) => trackById.get(id)!)

  return (
    <section
      aria-labelledby="top-artist-title"
      className="glass animate-rise relative overflow-hidden rounded-2xl p-5 md:p-6"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -left-24 size-72 rounded-full bg-amber-500/20 blur-3xl"
      />
      <div aria-hidden className="pointer-events-none absolute -right-20 -bottom-28 size-72 rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="relative flex flex-col gap-6 sm:flex-row">
        <button
          type="button"
          onClick={() => openArtist(top.name)}
          className="group relative self-start"
          aria-label={`Ver detalle de ${top.name}`}
        >
          <ArtistAvatar
            name={top.name}
            ring="#f59e0b"
            className="size-28 text-3xl transition-transform group-hover:scale-[1.03] md:size-32"
          />
          <span className="absolute -top-3 left-1/2 flex size-9 -translate-x-1/2 items-center justify-center rounded-full bg-amber-400 text-zinc-950 shadow-[0_0_24px_rgb(245_158_11/0.8)]">
            <Crown className="size-5" aria-hidden />
          </span>
        </button>

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-amber-400">
            <EqualizerBars color="#f59e0b" className="h-3" />
            Artista #1 de la playlist
          </p>
          <h2 id="top-artist-title" className="mt-1 font-display text-3xl font-bold tracking-tight text-zinc-50 md:text-4xl">
            <button type="button" onClick={() => openArtist(top.name)} className="text-left hover:underline">
              {top.name}
            </button>
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Aparece en <span className="font-semibold text-zinc-100">{top.count} canciones</span> · {share}% de la
            playlist
          </p>

          <div className="mt-4">
            <div className="flex h-2 overflow-hidden rounded-full bg-white/5" aria-hidden>
              <div className="bg-amber-400" style={{ width: `${mainPct}%` }} />
              <div className="bg-emerald-400/70" style={{ width: `${100 - mainPct}%` }} />
            </div>
            <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Mic2 className="size-3.5 text-amber-400" aria-hidden />
                {top.mainCount} como principal
              </span>
              <span className="inline-flex items-center gap-1.5">
                <UsersRound className="size-3.5 text-emerald-400" aria-hidden />
                {top.featCount} como featuring
              </span>
            </div>
          </div>

          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {featured.map((t) => (
              <li key={t.id} className="flex items-center gap-2.5 rounded-xl bg-white/[0.03] p-2 ring-1 ring-white/5">
                <CoverArt seed={t.title} className="size-9" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-100">{t.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{t.artists.join(', ')}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {top.collaborators.length > 0 && (
        <div className="relative mt-6 border-t border-white/5 pt-4">
          <button
            type="button"
            onClick={() => setShowCollabs((v) => !v)}
            aria-expanded={showCollabs}
            aria-controls="top-collabs"
            className="flex w-full items-center justify-between text-sm font-medium text-zinc-200"
          >
            <span>
              Colaboradores <span className="text-muted-foreground">({top.collaborators.length})</span>
            </span>
            <ChevronDown
              className={cn('size-4 text-muted-foreground transition-transform', showCollabs && 'rotate-180')}
              aria-hidden
            />
          </button>
          {showCollabs && (
            <ul id="top-collabs" className="mt-3 flex flex-wrap gap-2">
              {top.collaborators.map((c) => (
                <li key={c.name}>
                  <TracksHoverCard
                    title={`Con ${c.name}`}
                    trackIds={c.trackIds}
                    onClick={() => openArtist(c.name)}
                    triggerClassName="inline-flex items-center gap-2 rounded-full bg-white/[0.04] py-1 pr-3 pl-1 text-sm text-zinc-200 ring-1 ring-white/10 transition-colors hover:bg-white/[0.08] hover:ring-emerald-400/40"
                  >
                    <ArtistAvatar name={c.name} className="size-6 text-[10px]" />
                    {c.name}
                    <span className="rounded-full bg-emerald-500/15 px-1.5 text-xs font-semibold text-emerald-300 tabular-nums">
                      {c.trackIds.length}
                    </span>
                  </TracksHoverCard>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}

'use client'

import { Crown } from 'lucide-react'
import type { ArtistStat } from '@/lib/musicstats/types'
import { cn } from '@/lib/utils'
import { useAnalysis } from './analysis-context'
import { ArtistAvatar } from './artwork'
import { Panel, SectionTitle, TracksHoverCard } from './shared'

const PLACES = {
  1: { label: '1°', color: '#f59e0b', grad: 'from-amber-300 via-amber-500 to-amber-700', height: 'h-40 md:h-52' },
  2: { label: '2°', color: '#cbd5e1', grad: 'from-slate-100 via-slate-300 to-slate-500', height: 'h-28 md:h-36' },
  3: { label: '3°', color: '#d97745', grad: 'from-orange-300 via-orange-500 to-orange-800', height: 'h-20 md:h-28' },
} as const

function PodiumColumn({ artist, place }: { artist: ArtistStat; place: 1 | 2 | 3 }) {
  const { openArtist, trackById } = useAnalysis()
  const cfg = PLACES[place]
  const isFirst = place === 1

  return (
    <li className="flex min-w-0 flex-1 flex-col items-center" style={{ animationDelay: `${place * 120}ms` }}>
      <TracksHoverCard
        title={`Top canciones de ${artist.name}`}
        trackIds={artist.trackIds}
        limit={5}
        onClick={() => openArtist(artist.name)}
        label={`${cfg.label} lugar: ${artist.name}, ${artist.count} canciones. Ver detalle`}
        triggerClassName="group flex w-full flex-col items-center rounded-2xl pb-3 text-center"
      >
        <span className="relative">
          {isFirst && (
            <Crown
              aria-hidden
              className="absolute -top-7 left-1/2 size-7 -translate-x-1/2 text-amber-400 drop-shadow-[0_0_12px_rgb(245_158_11)]"
            />
          )}
          <ArtistAvatar
            name={artist.name}
            imageUrl={artist.imageUrl}
            ring={cfg.color}
            className={cn(
              'transition-transform duration-300 group-hover:-translate-y-1',
              isFirst ? 'size-20 text-xl md:size-24 md:text-2xl' : 'size-14 text-base md:size-18 md:text-lg',
            )}
          />
        </span>
        <span className="mt-3 w-full truncate px-1 font-display text-sm font-semibold text-zinc-50 md:text-base">
          {artist.name}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">{artist.count} canciones</span>
      </TracksHoverCard>

      <div
        className={cn(
          'relative w-full overflow-hidden rounded-t-2xl border-x border-t',
          cfg.height,
        )}
        style={{
          borderColor: `${cfg.color}55`,
          background: `linear-gradient(180deg, ${cfg.color}33, ${cfg.color}08 70%, transparent)`,
          boxShadow: isFirst ? `0 -10px 50px -10px ${cfg.color}88` : undefined,
        }}
      >
        <div className={cn('absolute inset-x-0 top-0 h-1 bg-gradient-to-r', cfg.grad)} />
        <div className="flex h-full flex-col items-center justify-start gap-2 px-2 pt-3 md:pt-4">
          <span
            className={cn(
              'bg-gradient-to-b bg-clip-text font-display font-black text-transparent',
              cfg.grad,
              isFirst ? 'text-5xl md:text-6xl' : 'text-4xl md:text-5xl',
            )}
          >
            {cfg.label}
          </span>
          {isFirst && (
            <ul className="hidden w-full max-w-48 flex-col gap-1 text-center text-xs text-zinc-300 md:flex">
              {artist.trackIds.slice(0, 3).map((id) => (
                <li key={id} className="truncate">
                  {trackById.get(id)?.title}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </li>
  )
}

export function Podium() {
  const { analysis } = useAnalysis()
  const [first, second, third] = analysis.artists

  return (
    <Panel aria-labelledby="podium-title" className="p-5 md:p-6">
      <SectionTitle id="podium-title" eyebrow="Ranking" title="El podio de la playlist" />
      <ol className="mt-12 flex items-end gap-2 md:gap-4">
        {second && <PodiumColumn artist={second} place={2} />}
        {first && <PodiumColumn artist={first} place={1} />}
        {third && <PodiumColumn artist={third} place={3} />}
      </ol>
      <div className="h-px w-full bg-gradient-to-r from-transparent via-white/15 to-transparent" />
    </Panel>
  )
}

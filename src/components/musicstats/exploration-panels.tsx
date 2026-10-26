'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { formatDuration } from '@/lib/musicstats/format'
import { cn } from '@/lib/utils'
import { useAnalysis } from './analysis-context'
import { ArtistAvatar, CoverArt } from './artwork'
import { ArtistNames, Panel, TracksHoverCard } from './shared'

function CollapsibleHeader({
  title,
  count,
  open,
  onToggle,
  controls,
}: {
  title: string
  count: number
  open: boolean
  onToggle: () => void
  controls: string
}) {
  return (
    <div className="flex items-center justify-between gap-3 p-5">
      <h2 className="font-display text-lg font-semibold text-zinc-50">
        {title} <span className="ml-1 text-sm font-normal text-muted-foreground tabular-nums">{count}</span>
      </h2>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={controls}
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-300 ring-1 ring-white/10 transition-colors hover:bg-white/5"
      >
        {open ? 'Ocultar lista' : 'Ver lista'}
        <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
    </div>
  )
}

export function TracklistPanel() {
  const { analysis } = useAnalysis()
  const [open, setOpen] = useState(true)

  return (
    <Panel aria-label="Lista de canciones" className="flex flex-col">
      <CollapsibleHeader
        title="Lista de canciones"
        count={analysis.tracks.length}
        open={open}
        onToggle={() => setOpen((v) => !v)}
        controls="tracklist"
      />
      {open && (
        <ol id="tracklist" className="scrollbar-thin max-h-[560px] overflow-y-auto border-t border-white/5 px-2 py-2">
          {analysis.tracks.map((track, i) => (
            <li
              key={track.id}
              className="group grid grid-cols-[2rem_auto_1fr_auto] items-center gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-white/[0.04]"
            >
              <span className="text-right text-sm text-muted-foreground tabular-nums group-hover:text-emerald-400">
                {i + 1}
              </span>
              <CoverArt seed={track.title} imageUrl={track.coverUrl} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-zinc-100">{track.title}</p>
                <p className="truncate text-xs">
                  <ArtistNames artists={track.artists} />
                </p>
              </div>
              <span className="text-xs text-muted-foreground tabular-nums">{formatDuration(track.duration)}</span>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  )
}

export function OtherArtistsPanel() {
  const { analysis, openArtist } = useAnalysis()
  const [open, setOpen] = useState(true)
  const rest = analysis.artists.slice(3)
  const max = rest[0]?.count ?? 1

  return (
    <Panel aria-label="Demás artistas" className="flex flex-col">
      <CollapsibleHeader
        title="Demás artistas"
        count={rest.length}
        open={open}
        onToggle={() => setOpen((v) => !v)}
        controls="other-artists"
      />
      {open && (
        <ol id="other-artists" className="scrollbar-thin max-h-[560px] overflow-y-auto border-t border-white/5 px-2 py-2">
          {rest.map((artist) => (
            <li key={artist.name}>
              <TracksHoverCard
                title={`Canciones de ${artist.name}`}
                trackIds={artist.trackIds}
                onClick={() => openArtist(artist.name)}
                triggerClassName="grid w-full grid-cols-[2.25rem_auto_1fr_auto] items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-white/[0.04]"
              >
                <span className="inline-flex h-6 items-center justify-center rounded-md bg-white/5 text-xs font-semibold text-zinc-300 tabular-nums ring-1 ring-white/10">
                  {artist.rank}°
                </span>
                <ArtistAvatar name={artist.name} imageUrl={artist.imageUrl} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-zinc-100">{artist.name}</span>
                  <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-white/5">
                    <span
                      className="block h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300"
                      style={{ width: `${(artist.count / max) * 100}%` }}
                    />
                  </span>
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {artist.count} {artist.count === 1 ? 'canción' : 'canciones'}
                </span>
              </TracksHoverCard>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  )
}

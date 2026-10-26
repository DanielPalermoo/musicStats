'use client'

import { Fragment } from 'react'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { formatDuration } from '@/lib/musicstats/format'
import { cn } from '@/lib/utils'
import { useAnalysis } from './analysis-context'
import { CoverArt } from './artwork'

export function Panel({
  className,
  children,
  ...props
}: React.ComponentProps<'section'>) {
  return (
    <section className={cn('glass rounded-2xl', className)} {...props}>
      {children}
    </section>
  )
}

export function SectionTitle({
  eyebrow,
  title,
  action,
  id,
}: {
  eyebrow?: string
  title: string
  action?: React.ReactNode
  id?: string
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow && (
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{eyebrow}</p>
        )}
        <h2 id={id} className="font-display text-lg font-semibold text-balance text-zinc-50 md:text-xl">
          {title}
        </h2>
      </div>
      {action}
    </div>
  )
}

export function ArtistNames({ artists, className }: { artists: string[]; className?: string }) {
  const { openArtist } = useAnalysis()
  return (
    <span className={cn('text-muted-foreground', className)}>
      {artists.map((name, i) => (
        <Fragment key={name}>
          {i > 0 && ', '}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              openArtist(name)
            }}
            className="rounded-sm transition-colors hover:text-zinc-100 hover:underline focus-visible:text-zinc-100"
          >
            {name}
          </button>
        </Fragment>
      ))}
    </span>
  )
}

export function MiniTrackList({ trackIds, limit }: { trackIds: string[]; limit?: number }) {
  const { trackById } = useAnalysis()
  const ids = limit ? trackIds.slice(0, limit) : trackIds
  return (
    <ul className="flex flex-col gap-1.5">
      {ids.map((id) => {
        const track = trackById.get(id)
        if (!track) return null
        return (
          <li key={id} className="flex items-center gap-2.5">
            <CoverArt seed={track.title} imageUrl={track.coverUrl} className="size-8" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-zinc-100">{track.title}</p>
              <p className="truncate text-xs text-muted-foreground">{track.artists.join(', ')}</p>
            </div>
            <span className="text-xs tabular-nums text-muted-foreground">{formatDuration(track.duration)}</span>
          </li>
        )
      })}
      {limit && trackIds.length > limit && (
        <li className="pt-1 text-xs text-muted-foreground">+{trackIds.length - limit} más</li>
      )}
    </ul>
  )
}

export function TracksHoverCard({
  title,
  trackIds,
  limit,
  children,
  triggerClassName,
  onClick,
  label,
}: {
  title: string
  trackIds: string[]
  limit?: number
  children: React.ReactNode
  triggerClassName?: string
  onClick?: () => void
  label?: string
}) {
  return (
    <HoverCard>
      <HoverCardTrigger
        delay={150}
        closeDelay={100}
        render={<button type="button" onClick={onClick} aria-label={label} className={triggerClassName} />}
      >
        {children}
      </HoverCardTrigger>
      <HoverCardContent className="w-72 rounded-xl border border-white/10 bg-zinc-950/95 p-3 backdrop-blur-xl">
        <p className="mb-2.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</p>
        <MiniTrackList trackIds={trackIds} limit={limit} />
      </HoverCardContent>
    </HoverCard>
  )
}

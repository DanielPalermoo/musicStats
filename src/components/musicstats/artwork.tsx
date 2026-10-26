'use client'

import { useState } from 'react'
import { gradientFor, initials } from '@/lib/musicstats/format'
import { cn } from '@/lib/utils'

export function ArtistAvatar({
  name,
  imageUrl,
  className,
  ring,
}: {
  name: string
  imageUrl?: string
  className?: string
  ring?: string
}) {
  const [hasError, setHasError] = useState(false)
  const showImage = Boolean(imageUrl && !hasError)

  return (
    <span
      aria-hidden
      className={cn(
        'relative inline-flex size-10 shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-display text-sm font-semibold text-white bg-zinc-800',
        className,
      )}
      style={{
        backgroundImage: !showImage ? gradientFor(name) : undefined,
        boxShadow: ring ? `0 0 0 2px #09090b, 0 0 0 4px ${ring}` : undefined,
      }}
    >
      <span
        className="absolute inset-0"
        style={{ background: 'radial-gradient(circle at 30% 25%, rgb(255 255 255 / 0.35), transparent 55%)' }}
      />
      <span className="relative drop-shadow-sm">{initials(name)}</span>
      {showImage && (
        <img
          src={imageUrl}
          alt={name}
          className="absolute inset-0 size-full object-cover"
          onError={() => setHasError(true)}
          loading="lazy"
        />
      )}
    </span>
  )
}

export function CoverArt({
  seed,
  imageUrl,
  className,
}: {
  seed: string
  imageUrl?: string
  className?: string
}) {
  const [hasError, setHasError] = useState(false)
  const showImage = Boolean(imageUrl && !hasError)

  return (
    <span
      aria-hidden
      className={cn('relative inline-block size-10 shrink-0 overflow-hidden rounded-md bg-zinc-800', className)}
      style={{ backgroundImage: !showImage ? gradientFor(`cover-${seed}`) : undefined }}
    >
      <span
        className="absolute -right-1/4 -bottom-1/4 size-3/4 rounded-full border border-white/25"
        style={{ background: 'radial-gradient(circle, rgb(0 0 0 / 0.35) 20%, transparent 22%)' }}
      />
      <span className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
      {showImage && (
        <img
          src={imageUrl}
          alt={seed}
          className="absolute inset-0 size-full object-cover"
          onError={() => setHasError(true)}
          loading="lazy"
        />
      )}
    </span>
  )
}

export function EqualizerBars({ className, color }: { className?: string; color?: string }) {
  return (
    <span aria-hidden className={cn('inline-flex h-4 items-end gap-0.5', className)}>
      {[0, 0.2, 0.4, 0.1].map((delay, i) => (
        <span
          key={i}
          className="animate-eq w-[3px] rounded-full"
          style={{ height: '100%', animationDelay: `${delay}s`, backgroundColor: color ?? 'currentColor' }}
        />
      ))}
    </span>
  )
}

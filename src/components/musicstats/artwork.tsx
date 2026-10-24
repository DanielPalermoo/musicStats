import { gradientFor, initials } from '@/lib/musicstats/format'
import { cn } from '@/lib/utils'

export function ArtistAvatar({
  name,
  className,
  ring,
}: {
  name: string
  className?: string
  ring?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'relative inline-flex size-10 shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-display text-sm font-semibold text-white',
        className,
      )}
      style={{
        backgroundImage: gradientFor(name),
        boxShadow: ring ? `0 0 0 2px #09090b, 0 0 0 4px ${ring}` : undefined,
      }}
    >
      <span
        className="absolute inset-0"
        style={{ background: 'radial-gradient(circle at 30% 25%, rgb(255 255 255 / 0.35), transparent 55%)' }}
      />
      <span className="relative drop-shadow-sm">{initials(name)}</span>
    </span>
  )
}

export function CoverArt({ seed, className }: { seed: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('relative inline-block size-10 shrink-0 overflow-hidden rounded-md', className)}
      style={{ backgroundImage: gradientFor(`cover-${seed}`) }}
    >
      <span
        className="absolute -right-1/4 -bottom-1/4 size-3/4 rounded-full border border-white/25"
        style={{ background: 'radial-gradient(circle, rgb(0 0 0 / 0.35) 20%, transparent 22%)' }}
      />
      <span className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
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

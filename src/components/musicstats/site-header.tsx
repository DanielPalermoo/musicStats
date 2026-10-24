import { AudioWaveform } from 'lucide-react'

export function Logo({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ''}`}>
      <span className="relative flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-[0_0_24px_-4px_rgb(16_185_129/0.7)]">
        <AudioWaveform className="size-5 text-zinc-950" strokeWidth={2.4} aria-hidden />
      </span>
      <span className="font-display text-lg font-bold tracking-tight text-zinc-50">
        Music<span className="text-emerald-400">Stats</span>
      </span>
    </span>
  )
}

export function SiteHeader({ onHome }: { onHome: () => void }) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-[#09090b]/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6">
        <button type="button" onClick={onHome} aria-label="MusicStats, volver al inicio" className="rounded-lg">
          <Logo />
        </button>
        <span className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-muted-foreground sm:inline-flex">
          <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgb(16_185_129)]" />
          Wrapped bajo demanda
        </span>
      </div>
    </header>
  )
}

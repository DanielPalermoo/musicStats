'use client'

import { useRef, useState } from 'react'
import { AudioWaveform, Download, Loader2 } from 'lucide-react'
import { toPng } from 'html-to-image'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { formatLongDuration } from '@/lib/musicstats/format'
import { PLATFORM_MAP } from '@/lib/musicstats/platforms'
import { useAnalysis } from './analysis-context'
import { ArtistAvatar } from './artwork'

const MEDALS = ['#f59e0b', '#cbd5e1', '#d97745']

function StoryCard() {
  const { analysis } = useAnalysis()
  const { playlist, stats, artists } = analysis
  const platform = PLATFORM_MAP[playlist.platform]
  const [first, second, third] = artists

  return (
    <div
      className="relative flex h-[640px] w-[360px] flex-col overflow-hidden rounded-[28px] bg-[#09090b] p-7 font-sans text-white"
      style={{
        backgroundImage:
          'radial-gradient(120% 60% at 0% 0%, rgb(16 185 129 / 0.45), transparent 60%), radial-gradient(90% 50% at 100% 100%, rgb(245 158 11 / 0.35), transparent 60%)',
      }}
    >
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-400">
            <AudioWaveform className="size-4 text-zinc-950" strokeWidth={2.6} />
          </span>
          <span className="font-display text-sm font-bold">MusicStats</span>
        </span>
        <span
          className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider"
          style={{ backgroundColor: `${platform.color}26`, color: platform.color }}
        >
          {platform.name}
        </span>
      </div>

      <p className="mt-8 text-[11px] font-medium uppercase tracking-[0.25em] text-emerald-300">Mi playlist en números</p>
      <h3 className="mt-2 font-display text-[34px] leading-[1.05] font-extrabold tracking-tight text-balance">
        {playlist.title}
      </h3>

      <div className="mt-7 flex items-end justify-center gap-3">
        {[second, first, third].map((a, i) => {
          if (!a) return null
          const place = i === 1 ? 0 : i === 0 ? 1 : 2
          const heights = ['h-28', 'h-20', 'h-14']
          return (
            <div key={a.name} className="flex w-[92px] flex-col items-center">
              <ArtistAvatar
                name={a.name}
                imageUrl={a.imageUrl}
                ring={MEDALS[place]}
                className={place === 0 ? 'size-16 text-lg' : 'size-12 text-sm'}
              />
              <p className="mt-2 w-full truncate text-center text-xs font-semibold">{a.name}</p>
              <p className="text-[10px] text-zinc-400">{a.count} canciones</p>
              <div
                className={`mt-2 flex w-full items-start justify-center rounded-t-xl pt-2 font-display text-2xl font-black ${heights[place]}`}
                style={{
                  background: `linear-gradient(180deg, ${MEDALS[place]}66, ${MEDALS[place]}10)`,
                  color: MEDALS[place],
                  borderTop: `2px solid ${MEDALS[place]}`,
                }}
              >
                {place + 1}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-auto grid grid-cols-2 gap-2.5">
        {[
          { k: 'Canciones', v: stats.totalTracks },
          { k: 'Artistas', v: stats.uniqueArtists },
          { k: 'Diversidad', v: `${stats.diversity}%` },
          { k: 'Duración', v: formatLongDuration(playlist.totalDuration) },
        ].map((s) => (
          <div key={s.k} className="rounded-2xl bg-white/[0.06] p-3 ring-1 ring-white/10">
            <p className="text-[10px] uppercase tracking-wider text-zinc-400">{s.k}</p>
            <p className="font-display text-xl font-bold">{s.v}</p>
          </div>
        ))}
      </div>
      <p className="mt-5 text-center text-[10px] tracking-wider text-zinc-500">Crea el tuyo en musicstats.app</p>
    </div>
  )
}

export function StoryCardDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { analysis } = useAnalysis()
  const ref = useRef<HTMLDivElement>(null)
  const [saving, setSaving] = useState(false)

  const download = async () => {
    if (!ref.current) return
    setSaving(true)
    try {
      const dataUrl = await toPng(ref.current, { pixelRatio: 3, cacheBust: true })
      const link = document.createElement('a')
      link.download = `musicstats-${analysis.playlist.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`
      link.href = dataUrl
      link.click()
      toast.success('Resumen descargado', { description: 'Listo para tus Stories.' })
    } catch {
      toast.error('No se pudo generar la imagen')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95dvh] w-auto max-w-[calc(100vw-2rem)] overflow-y-auto border border-white/10 bg-[#0d0e12] p-5 sm:max-w-fit">
        <DialogTitle className="font-display text-base font-semibold text-zinc-50">Tu tarjeta para compartir</DialogTitle>
        <DialogDescription className="-mt-2 text-xs text-muted-foreground">
          Formato 9:16, perfecto para Instagram Stories o X.
        </DialogDescription>
        <div className="mx-auto origin-top max-[400px]:scale-[0.85]">
          <div ref={ref} className="rounded-[28px]">
            <StoryCard />
          </div>
        </div>
        <button
          type="button"
          onClick={download}
          disabled={saving}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-400 disabled:opacity-70"
        >
          {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}
          Descargar PNG
        </button>
      </DialogContent>
    </Dialog>
  )
}

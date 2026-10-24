'use client'

import { useState } from 'react'
import { Check, Clock, Download, Link as LinkIcon, User } from 'lucide-react'
import { toast } from 'sonner'
import { formatLongDuration } from '@/lib/musicstats/format'
import { PLATFORM_MAP } from '@/lib/musicstats/platforms'
import { useAnalysis } from './analysis-context'
import { CoverArt } from './artwork'
import { PlatformIcon } from './platform-icon'

export function ResultsHeader({ onDownload }: { onDownload: () => void }) {
  const { analysis } = useAnalysis()
  const { playlist, stats } = analysis
  const platform = PLATFORM_MAP[playlist.platform]
  const [copied, setCopied] = useState(false)

  const copyLink = async () => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?share=${encodeURIComponent(playlist.url)}`
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      toast.success('Enlace copiado', { description: 'Cualquiera con el enlace verá este análisis.' })
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('No se pudo copiar el enlace')
    }
  }

  return (
    <div className="glass animate-rise flex flex-col gap-5 rounded-2xl p-4 md:flex-row md:items-center md:p-5">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <div className="relative">
          <CoverArt seed={playlist.title} className="size-16 rounded-xl md:size-20" />
          <span
            className="absolute -right-1.5 -bottom-1.5 flex size-7 items-center justify-center rounded-full border-2 border-[#09090b] bg-zinc-900"
            style={{ color: platform.color }}
          >
            <PlatformIcon platform={platform.id} className="size-4" />
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.18em]" style={{ color: platform.color }}>
            Playlist · {platform.name}
          </p>
          <h2 className="mt-0.5 truncate font-display text-xl font-bold text-zinc-50 md:text-2xl">{playlist.title}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 font-medium text-emerald-300 ring-1 ring-emerald-500/20">
              {stats.totalTracks} canciones
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1">
              <User className="size-3" aria-hidden />
              {playlist.owner}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1">
              <Clock className="size-3" aria-hidden />
              {formatLongDuration(playlist.totalDuration)}
            </span>
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={copyLink}
          className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-zinc-200 transition-colors hover:bg-white/[0.08] md:flex-none"
        >
          {copied ? <Check className="size-4 text-emerald-400" aria-hidden /> : <LinkIcon className="size-4" aria-hidden />}
          {copied ? 'Copiado' : <><span className="sm:hidden">Copiar</span><span className="hidden sm:inline">Copiar enlace</span></>}
        </button>
        <button
          type="button"
          onClick={onDownload}
          className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-zinc-950 shadow-[0_0_28px_-8px_rgb(16_185_129)] transition-all hover:bg-emerald-400 md:flex-none"
        >
          <Download className="size-4" aria-hidden />
          <span className="sm:hidden">Descargar</span>
          <span className="hidden sm:inline">Descargar resumen</span>
        </button>
      </div>
    </div>
  )
}

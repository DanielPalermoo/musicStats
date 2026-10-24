'use client'

import { useState } from 'react'
import { ArrowRight, Link2, Loader2, Sparkles } from 'lucide-react'
import { PLATFORMS, PLATFORM_MAP, detectPlatform } from '@/lib/musicstats/platforms'
import type { PlatformId } from '@/lib/musicstats/types'
import { cn } from '@/lib/utils'
import { PlatformIcon } from './platform-icon'

type Props = {
  platform: PlatformId
  onPlatformChange: (p: PlatformId) => void
  onSubmit: (url: string) => void
  loading: boolean
  error?: string
  compact: boolean
}

export function SearchHero({ platform, onPlatformChange, onSubmit, loading, error, compact }: Props) {
  const [value, setValue] = useState('')
  const [localError, setLocalError] = useState<string>()
  const detected = detectPlatform(value)
  const active = PLATFORM_MAP[detected ?? platform]

  const submit = (raw: string) => {
    const url = raw.trim()
    if (!url) {
      setLocalError('Pega primero el enlace de una playlist pública.')
      return
    }
    const found = detectPlatform(url)
    if (!found) {
      setLocalError('Ese enlace no parece de YouTube Music, Spotify, Deezer o SoundCloud.')
      return
    }
    setLocalError(undefined)
    if (found !== platform) onPlatformChange(found)
    onSubmit(url)
  }

  const shownError = localError ?? error

  return (
    <section
      aria-labelledby="hero-title"
      className={cn('relative mx-auto max-w-3xl text-center', compact ? 'pt-8 pb-2' : 'pt-14 pb-6 md:pt-24')}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-10 -z-10 mx-auto h-72 max-w-2xl rounded-full opacity-40 blur-3xl transition-colors duration-700"
        style={{ background: `radial-gradient(closest-side, ${active.color}, transparent)` }}
      />

      {!compact && (
        <div className="animate-rise">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-zinc-300">
            <Sparkles className="size-3.5 text-amber-400" aria-hidden />
            Tu Wrapped, cuando quieras
          </span>
          <h1
            id="hero-title"
            className="mt-5 font-display text-4xl font-bold tracking-tight text-balance text-zinc-50 md:text-6xl"
          >
            Convierte cualquier playlist en{' '}
            <span className="bg-gradient-to-r from-emerald-300 via-emerald-400 to-amber-300 bg-clip-text text-transparent">
              estadísticas
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
            Descubre tus artistas top, el podio, el mapa de colaboraciones y una tarjeta lista para compartir.
          </p>
        </div>
      )}
      {compact && (
        <h1 id="hero-title" className="sr-only">
          Analizar otra playlist
        </h1>
      )}

      <div
        role="radiogroup"
        aria-label="Plataforma"
        className={cn('flex flex-wrap justify-center gap-2', compact ? 'mt-0' : 'mt-9')}
      >
        {PLATFORMS.map((p) => {
          const selected = p.id === platform
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onPlatformChange(p.id)}
              className={cn(
                'group inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition-all duration-200',
                selected
                  ? 'border-transparent text-zinc-50'
                  : 'border-white/10 bg-white/[0.03] text-zinc-400 hover:border-white/20 hover:text-zinc-200',
              )}
              style={
                selected
                  ? {
                      backgroundColor: `${p.color}1f`,
                      boxShadow: `inset 0 0 0 1px ${p.color}80, 0 0 24px -6px ${p.color}`,
                    }
                  : undefined
              }
            >
              <span style={{ color: selected ? p.color : undefined }} className="transition-colors">
                <PlatformIcon platform={p.id} className="size-4" />
              </span>
              {p.name}
            </button>
          )
        })}
      </div>

      <form
        className="mt-5"
        onSubmit={(e) => {
          e.preventDefault()
          submit(value)
        }}
      >
        <div
          className="glass flex flex-col gap-2 rounded-2xl p-2 transition-shadow focus-within:shadow-[0_0_0_1px_var(--c),0_0_40px_-12px_var(--c)] sm:flex-row sm:items-center"
          style={{ ['--c' as string]: active.color }}
        >
          <label htmlFor="playlist-url" className="sr-only">
            Enlace de la playlist
          </label>
          <div className="flex min-w-0 flex-1 items-center gap-3 px-3">
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors"
              style={{ backgroundColor: `${active.color}1f`, color: active.color }}
              title={active.name}
            >
              {value && detected ? (
                <PlatformIcon platform={detected} className="size-4" />
              ) : (
                <Link2 className="size-4" aria-hidden />
              )}
            </span>
            <input
              id="playlist-url"
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              value={value}
              onChange={(e) => {
                setValue(e.target.value)
                setLocalError(undefined)
                const p = detectPlatform(e.target.value)
                if (p && p !== platform) onPlatformChange(p)
              }}
              placeholder="Pega el enlace de tu playlist pública..."
              aria-invalid={Boolean(shownError)}
              aria-describedby={shownError ? 'url-error' : undefined}
              className="h-11 min-w-0 flex-1 bg-transparent text-[15px] text-zinc-100 outline-none placeholder:text-zinc-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-zinc-950 transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-wait disabled:opacity-80"
            style={{ backgroundColor: active.color, boxShadow: `0 0 28px -6px ${active.color}` }}
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Analizando…
              </>
            ) : (
              <>
                Analizar Playlist
                <ArrowRight className="size-4" aria-hidden />
              </>
            )}
          </button>
        </div>
        <div className="mt-3 min-h-5 text-sm" aria-live="polite">
          {shownError ? (
            <p id="url-error" className="text-red-400">
              {shownError}
            </p>
          ) : (
            !compact && (
              <p className="text-muted-foreground">
                ¿Sin enlace a mano?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setValue(active.example)
                    submit(active.example)
                  }}
                  className="font-medium text-zinc-200 underline decoration-white/20 underline-offset-4 hover:decoration-white/60"
                >
                  Prueba con un ejemplo de {active.name}
                </button>
              </p>
            )
          )}
        </div>
      </form>
    </section>
  )
}

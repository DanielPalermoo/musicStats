'use client';

import { forwardRef, useState } from 'react';
import { Crown, Disc3, Music2, Sparkles, Trophy, Users } from 'lucide-react';
import type { PlaylistStats, PodiumEntry } from '@/types/stats';
import { getInitials, songsLabel } from '@/lib/format';

interface RankTheme {
  label: string;
  medalClass: string;
  rowClass: string;
  barClass: string;
  valueClass: string;
}

const RANK_THEMES: Record<PodiumEntry['rank'], RankTheme> = {
  1: {
    label: 'Oro',
    medalClass: 'bg-gradient-to-br from-amber-200 to-amber-500 text-amber-950',
    rowClass: 'border-amber-300/30 bg-amber-300/[0.07]',
    barClass: 'bg-gradient-to-r from-amber-300 to-amber-500',
    valueClass: 'text-amber-200',
  },
  2: {
    label: 'Plata',
    medalClass: 'bg-gradient-to-br from-zinc-200 to-zinc-500 text-zinc-900',
    rowClass: 'border-zinc-400/20 bg-white/[0.03]',
    barClass: 'bg-gradient-to-r from-zinc-300 to-zinc-500',
    valueClass: 'text-zinc-300',
  },
  3: {
    label: 'Bronce',
    medalClass: 'bg-gradient-to-br from-orange-300 to-orange-700 text-orange-950',
    rowClass: 'border-orange-400/20 bg-orange-400/[0.05]',
    barClass: 'bg-gradient-to-r from-orange-400 to-orange-700',
    valueClass: 'text-orange-300',
  },
};

interface CardAvatarProps {
  name: string;
  src?: string;
  size: number;
  className?: string;
}

/**
 * Avatar con respaldo de iniciales. Usa `crossOrigin` para que la imagen
 * remota pueda embeberse sin teñir el canvas durante la captura.
 */
function CardAvatar({ name, src, size, className = '' }: CardAvatarProps) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;

  return (
    <span
      style={{ width: size, height: size }}
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900 text-[10px] font-bold tracking-wide text-zinc-200 ring-1 ring-white/10 ${className}`}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          crossOrigin="anonymous"
          loading="eager"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span aria-hidden="true">{getInitials(name)}</span>
      )}
    </span>
  );
}

export interface ExportCardProps {
  /** Título de la playlist analizada. */
  playlistTitle: string;
  /** Estadísticas completas del análisis. */
  stats: PlaylistStats;
  /** Plataforma de origen, mostrada como insignia superior. */
  platformLabel?: string;
  className?: string;
}

/**
 * Tarjeta visual 9:16 (1080×1920 al exportar) con el resumen de la playlist:
 * métricas generales, artista #1 destacado y podio Top 3 con medallas.
 *
 * El nodo raíz tiene un tamaño lógico fijo de 360×640 (9:16). Al exportar se
 * escala a 1080×1920, y la vista previa puede reducirse con un contenedor que
 * aplique `transform: scale(...)` sin afectar a la captura.
 */
export const ExportCard = forwardRef<HTMLDivElement, ExportCardProps>(function ExportCard(
  { playlistTitle, stats, platformLabel, className = '' },
  ref
) {
  const podium = [...stats.podium].sort((a, b) => a.rank - b.rank);
  const topEntry = podium.find((entry) => entry.rank === 1) ?? podium[0];
  const topArtist = stats.topArtist ?? topEntry?.artist ?? null;
  const maxAppearances = Math.max(
    1,
    ...podium.map((entry) => entry.artist.appearanceCount)
  );

  return (
    <div
      ref={ref}
      role="img"
      aria-label={`Resumen exportable de la playlist ${playlistTitle}`}
      className={`relative flex h-[640px] w-[360px] shrink-0 flex-col overflow-hidden rounded-[1.75rem] border border-white/10 bg-zinc-950 p-5 text-zinc-50 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.95)] ${className}`}
    >
      {/* Fondos decorativos: degradados suaves emerald/amber sobre zinc. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(52,211,153,0.18),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(251,191,36,0.14),transparent_55%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(9,9,11,0)_0%,rgba(9,9,11,0.55)_60%,rgba(9,9,11,0.95)_100%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 top-24 h-44 w-44 rounded-full bg-emerald-400/10 blur-2xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-16 bottom-32 h-44 w-44 rounded-full bg-amber-400/10 blur-2xl"
      />

      <div className="relative flex flex-1 flex-col">
        <header className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-300 to-emerald-600 text-emerald-950 shadow-[0_0_28px_-8px_rgba(52,211,153,0.9)]">
              <Disc3 className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-black tracking-tight text-zinc-50">MusicStats</p>
              <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                Playlist Wrapped
              </p>
            </div>
          </div>
          <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-emerald-300">
            {platformLabel ?? 'Resumen'}
          </span>
        </header>

        <section className="mt-5">
          <p className="text-[9px] font-semibold uppercase tracking-[0.28em] text-zinc-500">
            Tu playlist
          </p>
          <h2 className="mt-1 line-clamp-3 text-2xl font-black leading-[1.1] tracking-tight text-zinc-50">
            {playlistTitle}
          </h2>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2">
              <p className="flex items-center gap-1 text-[8px] font-semibold uppercase tracking-wider text-zinc-500">
                <Music2 className="h-2.5 w-2.5" aria-hidden="true" />
                Canciones
              </p>
              <p className="mt-0.5 text-lg font-black tabular-nums text-zinc-50">
                {stats.totalTracks.toLocaleString('es')}
              </p>
              <p className="text-[9px] text-zinc-500">{songsLabel(stats.totalTracks)}</p>
            </div>
            <div className="rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2">
              <p className="flex items-center gap-1 text-[8px] font-semibold uppercase tracking-wider text-zinc-500">
                <Users className="h-2.5 w-2.5" aria-hidden="true" />
                Artistas
              </p>
              <p className="mt-0.5 text-lg font-black tabular-nums text-zinc-50">
                {stats.totalArtists.toLocaleString('es')}
              </p>
              <p className="text-[9px] text-zinc-500">únicos en la playlist</p>
            </div>
          </div>
        </section>

        <section className="relative mt-3 overflow-hidden rounded-2xl border border-amber-300/25 bg-gradient-to-br from-amber-400/15 via-zinc-900/90 to-zinc-950 p-3 shadow-[0_18px_40px_-26px_rgba(251,191,36,0.65)]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-amber-300/20 blur-2xl"
          />
          <div className="relative flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.2em] text-amber-300">
              <Trophy className="h-3 w-3" aria-hidden="true" />
              Artista #1
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-300/15 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-amber-200">
              <Sparkles className="h-2.5 w-2.5" aria-hidden="true" />
              Destacado
            </span>
          </div>

          {topArtist ? (
            <div className="relative mt-2 flex items-center gap-2.5">
              <CardAvatar
                name={topArtist.name}
                src={topEntry?.thumbnailUrl}
                size={46}
                className="ring-2 ring-amber-300/60"
              />
              <div className="min-w-0">
                <p className="truncate text-base font-extrabold tracking-tight text-zinc-50">
                  {topArtist.name}
                </p>
                <p className="text-[10px] text-amber-200/80">
                  Aparece en {songsLabel(topArtist.appearanceCount)}
                </p>
                <p className="text-[9px] text-zinc-400">
                  {topArtist.mainTrackCount} como artista principal
                </p>
              </div>
              <Crown className="ml-auto h-5 w-5 shrink-0 text-amber-300" aria-hidden="true" />
            </div>
          ) : (
            <p className="relative mt-2 text-[11px] text-zinc-400">
              Sin artistas válidos en esta playlist.
            </p>
          )}
        </section>

        <section className="mt-4 flex-1" aria-labelledby="export-podium-title">
          <div className="flex items-center justify-between">
            <h3
              id="export-podium-title"
              className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-400"
            >
              Podio Top 3
            </h3>
            <span className="text-[8px] font-semibold uppercase tracking-widest text-zinc-600">
              Más escuchados
            </span>
          </div>

          {podium.length > 0 ? (
            <ol className="mt-2 space-y-1.5">
              {podium.map((entry) => {
                const theme = RANK_THEMES[entry.rank];
                const percentage = Math.max(
                  4,
                  Math.round((entry.artist.appearanceCount / maxAppearances) * 100)
                );

                return (
                  <li
                    key={`${entry.rank}-${entry.artist.key}`}
                    className={`flex items-center gap-2.5 rounded-xl border px-2.5 py-2 ${theme.rowClass}`}
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-black shadow-sm ${theme.medalClass}`}
                      aria-label={`Medalla de ${theme.label}`}
                    >
                      {entry.rank}
                    </span>
                    <CardAvatar
                      name={entry.artist.name}
                      src={entry.thumbnailUrl}
                      size={30}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-bold text-zinc-100">
                        {entry.artist.name}
                      </p>
                      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-zinc-800">
                        <div
                          className={`h-full rounded-full ${theme.barClass}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`text-[11px] font-black tabular-nums ${theme.valueClass}`}>
                        {entry.artist.appearanceCount}
                      </p>
                      <p className="text-[8px] font-semibold uppercase tracking-wider text-zinc-500">
                        {theme.label}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="mt-2 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2 text-[11px] text-zinc-500">
              No hay suficientes artistas para armar el podio.
            </p>
          )}
        </section>

        <footer className="mt-3 flex items-center justify-between border-t border-white/5 pt-2.5">
          <p className="text-[9px] text-zinc-500">
            Creado con <span className="font-bold text-emerald-300">MusicStats</span>
          </p>
          <p className="text-[8px] font-semibold uppercase tracking-[0.18em] text-zinc-600">
            Top 3 · Colaboraciones
          </p>
        </footer>
      </div>
    </div>
  );
});

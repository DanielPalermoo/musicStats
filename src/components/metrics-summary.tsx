'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronDown,
  ListMusic,
  Music2,
  Sparkles,
  Trophy,
  UserRound,
  Users,
} from 'lucide-react';
import type { ArtistStats, CollaborationInfo, PlaylistStats } from '@/types/stats';
import { songsLabel } from '@/lib/format';
import { ArtistAvatar } from './artist-avatar';

interface MetricsSummaryProps {
  stats: PlaylistStats;
  onSelectArtist: (artist: ArtistStats) => void;
}

function MetricCard({
  icon,
  label,
  value,
  hint,
  delay,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4"
    >
      <div className="flex items-center gap-2 text-zinc-400">
        <span className="rounded-lg bg-zinc-800/80 p-1.5">{icon}</span>
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-3 text-3xl font-black tabular-nums text-zinc-50">{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{hint}</p>
    </motion.div>
  );
}

function CollaboratorRow({
  collab,
  topArtistName,
  topArtistKey,
  stats,
  onSelectArtist,
}: {
  collab: CollaborationInfo;
  topArtistName: string;
  topArtistKey: string;
  stats: PlaylistStats;
  onSelectArtist: (artist: ArtistStats) => void;
}) {
  const [open, setOpen] = useState(false);

  const matchedArtist = stats.artists.find(
    (artist) =>
      artist.key !== topArtistKey && artist.name.toLowerCase() === collab.artist.toLowerCase()
  );
  const openable = Boolean(matchedArtist);

  const previewId = `collab-preview-${topArtistKey}-${collab.artist}`;

  function hide() {
    setOpen(false);
  }

  return (
    <li
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={hide}
      onFocus={() => setOpen(true)}
      onBlur={hide}
    >
      <AnimatePresence>
        {open && (
          <motion.div
            id={previewId}
            role="tooltip"
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.16 }}
            className="pointer-events-none absolute bottom-full left-0 z-50 mb-2 w-60 max-w-[70vw] rounded-2xl border border-zinc-700/80 bg-zinc-950/95 p-3 text-left shadow-2xl backdrop-blur"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
              Canciones con {topArtistName}
            </p>
            {collab.sharedTracks.length > 0 ? (
              <ol className="mt-2 space-y-1.5">
                {collab.sharedTracks.map((track, index) => (
                  <li
                    key={`${collab.artist}-${track}-${index}`}
                    className="flex items-start gap-2 text-xs text-zinc-200"
                  >
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[9px] font-bold text-zinc-400">
                      {index + 1}
                    </span>
                    <span className="line-clamp-2">{track}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-2 text-xs text-zinc-500">Sin canciones compartidas registradas.</p>
            )}
            <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-zinc-800/80 px-2 py-1">
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                <Music2 className="h-3 w-3" aria-hidden="true" />
                {songsLabel(collab.sharedTrackCount)}
              </span>
              {openable && (
                <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                  Ver perfil ↗
                </span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        disabled={!openable}
        onClick={() => {
          if (matchedArtist) onSelectArtist(matchedArtist);
        }}
        aria-describedby={open ? previewId : undefined}
        aria-label={`${collab.artist}, ${songsLabel(collab.sharedTrackCount)} con ${topArtistName}${
          openable ? '. Abrir su perfil' : ''
        }`}
        className={`group flex w-full items-center justify-between gap-2 rounded-lg bg-zinc-950/60 px-2.5 py-1.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-white/50 ${
          openable ? 'cursor-pointer hover:bg-zinc-800/70' : 'cursor-default'
        }`}
      >
        <span className="flex min-w-0 items-center gap-2">
          <ArtistAvatar name={collab.artist} size="sm" className="h-6 w-6 text-[9px]" />
          <span className="truncate text-xs text-zinc-200 transition-colors group-hover:text-zinc-50">
            {collab.artist}
          </span>
          {openable && (
            <UserRound className="h-3 w-3 shrink-0 text-zinc-600" aria-hidden="true" />
          )}
        </span>
        <span className="shrink-0 rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-zinc-300">
          {songsLabel(collab.sharedTrackCount)}
        </span>
      </button>
    </li>
  );
}

/**
 * Resumen de métricas clave de la playlist y tarjeta destacada del artista #1
 * con su lista desplegable de colaboradores.
 */
export function MetricsSummary({ stats, onSelectArtist }: MetricsSummaryProps) {
  const [showCollaborators, setShowCollaborators] = useState(false);
  const topArtist = stats.topArtist;
  const collaboratorCount = topArtist?.collaborations.length ?? 0;

  return (
    <section aria-labelledby="metrics-title" className="space-y-3">
      <div>
        <h2 id="metrics-title" className="text-lg font-bold text-zinc-100">
          Resumen de la playlist
        </h2>
        <p className="text-xs text-zinc-500">Los números principales del análisis.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.8fr)]">
        <MetricCard
          icon={<ListMusic className="h-4 w-4" aria-hidden="true" />}
          label="Canciones"
          value={stats.totalTracks.toLocaleString('es')}
          hint="Pistas totales de la playlist"
          delay={0.02}
        />
        <MetricCard
          icon={<Users className="h-4 w-4" aria-hidden="true" />}
          label="Artistas únicos"
          value={stats.totalArtists.toLocaleString('es')}
          hint="Artistas normalizados sin duplicados"
          delay={0.06}
        />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.35 }}
          className="relative overflow-hidden rounded-2xl border border-amber-400/25 bg-gradient-to-br from-amber-400/10 via-zinc-900/80 to-zinc-900/80 p-4 sm:col-span-2 lg:col-span-1"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-amber-400/15 blur-3xl"
          />

          <div className="relative flex flex-wrap items-start justify-between gap-2">
            <div className="flex items-center gap-2 text-amber-300">
              <Trophy className="h-4 w-4" aria-hidden="true" />
              <span className="text-xs font-semibold uppercase tracking-wide">Artista #1</span>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
              <Sparkles className="h-3 w-3" aria-hidden="true" /> Destacado
            </span>
          </div>

          {topArtist ? (
            <div className="relative mt-3">
              <div className="flex items-center gap-3">
                <ArtistAvatar name={topArtist.name} size="md" className="ring-amber-300/50" />
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => onSelectArtist(topArtist)}
                    className="block max-w-full truncate text-left text-lg font-bold text-zinc-50 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70"
                  >
                    {topArtist.name}
                  </button>
                  <p className="text-xs text-zinc-400">
                    Aparece en {songsLabel(topArtist.appearanceCount)} ·{' '}
                    {topArtist.mainTrackCount} como principal
                  </p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onSelectArtist(topArtist)}
                  className="rounded-lg border border-zinc-700 bg-zinc-900/80 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-200 transition-colors hover:border-amber-300/50 hover:text-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70"
                >
                  Ver perfil completo
                </button>
                <button
                  type="button"
                  aria-expanded={showCollaborators}
                  aria-controls="top-artist-collaborators"
                  onClick={() => setShowCollaborators((value) => !value)}
                  className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-900/80 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-200 transition-colors hover:border-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                >
                  Colaboradores ({collaboratorCount})
                  <ChevronDown
                    aria-hidden="true"
                    className={`h-3.5 w-3.5 transition-transform ${
                      showCollaborators ? 'rotate-180' : ''
                    }`}
                  />
                </button>
              </div>

              <AnimatePresence initial={false}>
                {showCollaborators && (
                  <motion.div
                    id="top-artist-collaborators"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22 }}
                    className="overflow-hidden"
                  >
                    {collaboratorCount > 0 ? (
                      <ul className="mt-3 max-h-44 space-y-1 overflow-y-auto pr-1">
                        {topArtist.collaborations.map((collab) => (
                          <CollaboratorRow
                            key={collab.artist}
                            collab={collab}
                            topArtistName={topArtist.name}
                            topArtistKey={topArtist.key}
                            stats={stats}
                            onSelectArtist={onSelectArtist}
                          />
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-3 text-xs text-zinc-500">
                        No tiene colaboraciones registradas en esta playlist.
                      </p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <p className="relative mt-3 text-sm text-zinc-500">
              No se encontraron artistas válidos en esta playlist.
            </p>
          )}
        </motion.div>
      </div>
    </section>
  );
}

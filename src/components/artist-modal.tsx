'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronDown,
  Disc3,
  Music2,
  Sparkles,
  Trophy,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import type { ArtistStats, PodiumEntry } from '@/types/stats';
import { songsLabel } from '@/lib/format';
import { ArtistAvatar } from './artist-avatar';

interface ArtistModalProps {
  /** Artista seleccionado o `null` cuando el modal está cerrado. */
  artist: ArtistStats | null;
  /** Puesto en el podio, si el artista pertenece al Top 3. */
  rank?: PodiumEntry['rank'];
  /** Portada usada como imagen de referencia del artista. */
  thumbnailUrl?: string;
  onClose: () => void;
}

const RANK_LABELS: Record<PodiumEntry['rank'], string> = {
  1: '1° puesto · Oro',
  2: '2° puesto · Plata',
  3: '3° puesto · Bronce',
};

/**
 * Modal accesible con el detalle completo de un artista: métricas, todas sus
 * canciones y la matriz de colaboradores.
 */
export function ArtistModal({ artist, rank, thumbnailUrl, onClose }: ArtistModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [showCollaborations, setShowCollaborations] = useState(true);

  useEffect(() => {
    setShowCollaborations(true);
  }, [artist?.key]);

  useEffect(() => {
    if (!artist) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab') return;

      const root = dialogRef.current;
      if (!root) return;

      const focusable = Array.from(
        root.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => !element.hasAttribute('disabled'));

      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 30);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      window.clearTimeout(focusTimer);
    };
  }, [artist, onClose]);

  return (
    <AnimatePresence>
      {artist && (
        <motion.div
          key="artist-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/75 p-3 backdrop-blur-sm sm:items-center sm:p-6"
          onClick={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <motion.div
            key={artist.key}
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="artist-modal-title"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 220, damping: 24 }}
            className="relative my-auto w-full max-w-3xl overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950 shadow-2xl"
          >
            <div className="flex max-h-[88vh] flex-col">
              <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-950/95 px-4 py-3 backdrop-blur sm:px-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Perfil del artista
                </p>
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={onClose}
                  aria-label="Cerrar perfil del artista"
                  className="rounded-full border border-zinc-800 bg-zinc-900 p-2 text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <div className="overflow-y-auto overscroll-contain">
                <header className="relative overflow-hidden border-b border-zinc-800 bg-gradient-to-br from-amber-400/10 via-zinc-900/60 to-zinc-950 px-4 py-5 sm:px-6">
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-amber-400/15 blur-3xl"
                  />

                  <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
                    <ArtistAvatar
                      name={artist.name}
                      src={thumbnailUrl}
                      size="xl"
                      className="ring-amber-300/40"
                    />

                    <div className="min-w-0 flex-1">
                      {rank && (
                        <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-200">
                          <Trophy className="h-3 w-3" aria-hidden="true" />
                          {RANK_LABELS[rank]}
                        </span>
                      )}
                      <h2
                        id="artist-modal-title"
                        className="break-words text-2xl font-black text-zinc-50 sm:text-3xl"
                      >
                        {artist.name}
                      </h2>
                      <p className="mt-1 text-sm text-zinc-400">
                        Aparece en {songsLabel(artist.appearanceCount)} de la playlist.
                      </p>
                    </div>
                  </div>

                  <dl className="relative mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-2.5">
                      <dt className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                        Apariciones
                      </dt>
                      <dd className="mt-0.5 text-xl font-bold tabular-nums text-zinc-100">
                        {artist.appearanceCount}
                      </dd>
                    </div>
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-2.5">
                      <dt className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                        Como principal
                      </dt>
                      <dd className="mt-0.5 text-xl font-bold tabular-nums text-zinc-100">
                        {artist.mainTrackCount}
                      </dd>
                    </div>
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-2.5">
                      <dt className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                        Como colaborador
                      </dt>
                      <dd className="mt-0.5 text-xl font-bold tabular-nums text-zinc-100">
                        {artist.featuredTrackCount}
                      </dd>
                    </div>
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-2.5">
                      <dt className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                        Colaboradores
                      </dt>
                      <dd className="mt-0.5 text-xl font-bold tabular-nums text-zinc-100">
                        {artist.collaborations.length}
                      </dd>
                    </div>
                  </dl>
                </header>

                <div className="space-y-6 px-4 py-5 sm:px-6">
                  <section aria-labelledby="artist-collaborations-title">
                    <button
                      type="button"
                      aria-expanded={showCollaborations}
                      aria-controls="artist-collaborations-list"
                      onClick={() => setShowCollaborations((value) => !value)}
                      className="flex w-full items-center justify-between gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                    >
                      <span className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-emerald-300" aria-hidden="true" />
                        <span
                          id="artist-collaborations-title"
                          className="text-sm font-bold text-zinc-100"
                        >
                          Matriz de colaboradores ({artist.collaborations.length})
                        </span>
                      </span>
                      <ChevronDown
                        aria-hidden="true"
                        className={`h-4 w-4 text-zinc-400 transition-transform ${
                          showCollaborations ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    <AnimatePresence initial={false}>
                      {showCollaborations && (
                        <motion.div
                          id="artist-collaborations-list"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.22 }}
                          className="overflow-hidden"
                        >
                          {artist.collaborations.length > 0 ? (
                            <ul className="mt-3 space-y-2">
                              {artist.collaborations.map((collab) => (
                                <li
                                  key={collab.artist}
                                  className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-2.5"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="flex min-w-0 items-center gap-2">
                                      <ArtistAvatar
                                        name={collab.artist}
                                        size="sm"
                                        className="h-8 w-8 text-[10px]"
                                      />
                                      <span className="truncate text-sm font-medium text-zinc-100">
                                        {collab.artist}
                                      </span>
                                    </span>
                                    <span className="shrink-0 rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-emerald-300">
                                      {songsLabel(collab.sharedTrackCount)}
                                    </span>
                                  </div>
                                  {collab.sharedTracks.length > 0 && (
                                    <p className="mt-1.5 line-clamp-2 pl-10 text-[11px] text-zinc-500">
                                      {collab.sharedTracks.join(' · ')}
                                    </p>
                                  )}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-3 text-sm text-zinc-500">
                              No tiene colaboraciones registradas en esta playlist.
                            </p>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </section>

                  <section aria-labelledby="artist-tracks-title">
                    <div className="flex items-center gap-2">
                      <Disc3 className="h-4 w-4 text-amber-300" aria-hidden="true" />
                      <h3 id="artist-tracks-title" className="text-sm font-bold text-zinc-100">
                        Todas sus canciones ({artist.tracks.length})
                      </h3>
                    </div>

                    <ul className="mt-3 space-y-1.5">
                      {artist.tracks.map((track, index) => (
                        <li
                          key={`${track.trackId}-${index}`}
                          className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 px-3 py-2.5"
                        >
                          <div className="flex items-start gap-2.5">
                            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-bold tabular-nums text-zinc-400">
                              {index + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <p className="min-w-0 break-words text-sm font-medium text-zinc-100">
                                  {track.trackTitle}
                                </p>
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                                    track.isMainArtist
                                      ? 'bg-amber-400/15 text-amber-300'
                                      : 'bg-sky-400/10 text-sky-300'
                                  }`}
                                >
                                  <Sparkles className="h-2.5 w-2.5" aria-hidden="true" />
                                  {track.isMainArtist ? 'Principal' : 'Colaborador'}
                                </span>
                              </div>
                              <p className="mt-1 flex items-start gap-1 text-[11px] text-zinc-500">
                                {track.collaborators.length > 0 ? (
                                  <>
                                    <UserRound
                                      className="mt-0.5 h-3 w-3 shrink-0"
                                      aria-hidden="true"
                                    />
                                    <span>
                                      Con{' '}
                                      <span className="text-zinc-400">
                                        {track.collaborators.join(', ')}
                                      </span>
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <Music2
                                      className="mt-0.5 h-3 w-3 shrink-0"
                                      aria-hidden="true"
                                    />
                                    <span>Sin colaboradores en este tema.</span>
                                  </>
                                )}
                              </p>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

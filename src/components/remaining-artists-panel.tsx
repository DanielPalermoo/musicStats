'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ListOrdered, Music2, Sparkles } from 'lucide-react';
import type { ArtistStats } from '@/types/stats';
import { songsLabel } from '@/lib/format';
import { ArtistAvatar } from './artist-avatar';

interface RemainingArtistsPanelProps {
  /** Artistas desde el 4° puesto en adelante (por ejemplo, `stats.artists.slice(3)`). */
  artists: ArtistStats[];
  onSelectArtist: (artist: ArtistStats) => void;
}

/** Máximo de canciones destacadas que se previsualizan en el hover de cada fila. */
const PREVIEW_TRACK_LIMIT = 4;

/**
 * Ranking de artistas fuera del podio (4° puesto en adelante) con botón de
 * colapso/despliegue, previsualización de canciones en hover y apertura del
 * modal del artista al hacer click.
 */
export function RemainingArtistsPanel({ artists, onSelectArtist }: RemainingArtistsPanelProps) {
  const [showArtists, setShowArtists] = useState(true);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  if (artists.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby="remaining-artists-title"
      className="rounded-2xl border border-zinc-800 bg-zinc-900/40"
    >
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <h2
            id="remaining-artists-title"
            className="flex items-center gap-2 text-lg font-bold text-zinc-100"
          >
            <ListOrdered className="h-5 w-5 text-emerald-300" aria-hidden="true" />
            Demás artistas
          </h2>
          <p className="text-xs text-zinc-500">
            {artists.length === 1
              ? '1 artista fuera del podio Top 3.'
              : `${artists.length} artistas fuera del podio Top 3.`}
          </p>
        </div>

        <button
          type="button"
          aria-expanded={showArtists}
          aria-controls="remaining-artists-panel"
          onClick={() => setShowArtists((value) => !value)}
          className="inline-flex w-fit items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-200 transition-colors hover:border-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        >
          {showArtists ? 'Ocultar lista' : `Ver ${artists.length} artistas`}
          <ChevronDown
            aria-hidden="true"
            className={`h-4 w-4 transition-transform ${showArtists ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {showArtists && (
          <motion.div
            id="remaining-artists-panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <ol className="max-h-[32rem] space-y-1 overflow-y-auto border-t border-zinc-800 p-3 sm:p-4">
              {artists.map((artist, index) => {
                const position = index + 4;
                const isHovered = hoveredKey === artist.key;
                const previewId = `remaining-artist-preview-${artist.key}`;
                const previewTracks = artist.tracks.slice(0, PREVIEW_TRACK_LIMIT);

                return (
                  <li
                    key={artist.key}
                    className="relative"
                    onMouseEnter={() => setHoveredKey(artist.key)}
                    onMouseLeave={() => setHoveredKey(null)}
                    onFocus={() => setHoveredKey(artist.key)}
                    onBlur={() => setHoveredKey(null)}
                  >
                    <AnimatePresence>
                      {isHovered && (
                        <motion.div
                          id={previewId}
                          role="tooltip"
                          initial={{ opacity: 0, y: 6, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 6, scale: 0.97 }}
                          transition={{ duration: 0.16 }}
                          className="pointer-events-none absolute bottom-full left-0 z-50 mb-2 w-64 max-w-[75vw] rounded-2xl border border-zinc-700/80 bg-zinc-950/95 p-3 text-left shadow-2xl backdrop-blur"
                        >
                          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                            <Sparkles className="h-3.5 w-3.5 text-emerald-300" aria-hidden="true" />
                            Canciones destacadas
                          </p>
                          {previewTracks.length > 0 ? (
                            <ol className="mt-2 space-y-1.5">
                              {previewTracks.map((track, trackIndex) => (
                                <li
                                  key={`${track.trackId}-${trackIndex}`}
                                  className="flex items-start gap-2 text-xs text-zinc-200"
                                >
                                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[9px] font-bold text-zinc-400">
                                    {trackIndex + 1}
                                  </span>
                                  <span className="line-clamp-2">{track.trackTitle}</span>
                                </li>
                              ))}
                            </ol>
                          ) : (
                            <p className="mt-2 text-xs text-zinc-500">Sin canciones registradas.</p>
                          )}
                          <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-zinc-800/80 px-2 py-1">
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                              {position}° puesto
                            </span>
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                              <Music2 className="h-3 w-3" aria-hidden="true" />
                              {songsLabel(artist.appearanceCount)}
                            </span>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <button
                      type="button"
                      onClick={() => onSelectArtist(artist)}
                      aria-describedby={isHovered ? previewId : undefined}
                      aria-label={`Ver perfil de ${artist.name}, ${position}° puesto, ${songsLabel(
                        artist.appearanceCount
                      )}`}
                      className="group flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left outline-none transition-colors hover:bg-zinc-800/40 focus-visible:ring-2 focus-visible:ring-white/50"
                    >
                      <span className="w-6 shrink-0 text-right text-[11px] font-semibold tabular-nums text-zinc-600">
                        {position}
                      </span>
                      <ArtistAvatar name={artist.name} size="sm" className="h-9 w-9 text-[10px]" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-zinc-100">
                          {artist.name}
                        </span>
                        <span className="block truncate text-[11px] text-zinc-500">
                          {artist.mainTrackCount} como principal
                        </span>
                      </span>
                      <span className="shrink-0 rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-zinc-300">
                        {songsLabel(artist.appearanceCount)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

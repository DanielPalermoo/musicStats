'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Crown, Music2, Sparkles } from 'lucide-react';
import type { ArtistStats, PodiumEntry } from '@/types/stats';
import { songsLabel } from '@/lib/format';
import { ArtistAvatar } from './artist-avatar';

interface RankTheme {
  label: string;
  medalName: string;
  medal: string;
  pedestalHeight: string;
  pedestalGradient: string;
  cardBorder: string;
  cardGlow: string;
  rankText: string;
  avatarRing: string;
  badgeClass: string;
}

const RANK_THEMES: Record<PodiumEntry['rank'], RankTheme> = {
  1: {
    label: '1°',
    medalName: 'Oro',
    medal: '🥇',
    pedestalHeight: 'h-28 sm:h-36 md:h-44',
    pedestalGradient: 'from-amber-400/80 via-amber-500/35 to-amber-500/5',
    cardBorder: 'border-amber-400/40',
    cardGlow: 'shadow-[0_25px_60px_-25px_rgba(251,191,36,0.55)]',
    rankText: 'text-amber-300',
    avatarRing: 'ring-amber-400/70',
    badgeClass: 'bg-amber-400 text-amber-950',
  },
  2: {
    label: '2°',
    medalName: 'Plata',
    medal: '🥈',
    pedestalHeight: 'h-20 sm:h-26 md:h-32',
    pedestalGradient: 'from-zinc-300/70 via-zinc-400/30 to-zinc-500/5',
    cardBorder: 'border-zinc-400/30',
    cardGlow: 'shadow-[0_20px_50px_-25px_rgba(212,212,216,0.45)]',
    rankText: 'text-zinc-300',
    avatarRing: 'ring-zinc-300/60',
    badgeClass: 'bg-zinc-300 text-zinc-900',
  },
  3: {
    label: '3°',
    medalName: 'Bronce',
    medal: '🥉',
    pedestalHeight: 'h-16 sm:h-20 md:h-24',
    pedestalGradient: 'from-orange-700/80 via-orange-800/40 to-orange-900/5',
    cardBorder: 'border-orange-600/30',
    cardGlow: 'shadow-[0_20px_50px_-25px_rgba(194,120,74,0.45)]',
    rankText: 'text-orange-300',
    avatarRing: 'ring-orange-500/60',
    badgeClass: 'bg-orange-500 text-orange-950',
  },
};

/** Orden visual del podio: 2° a la izquierda, 1° al centro y 3° a la derecha. */
const VISUAL_ORDER: PodiumEntry['rank'][] = [2, 1, 3];

interface PodiumProps {
  podium: PodiumEntry[];
  onSelectArtist: (artist: ArtistStats) => void;
}

/**
 * Podio animado del Top 3 con popover de canciones destacadas y apertura
 * del modal del artista al hacer click.
 */
export function Podium({ podium, onSelectArtist }: PodiumProps) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const entryByRank = new Map<PodiumEntry['rank'], PodiumEntry>();
  for (const entry of podium) {
    entryByRank.set(entry.rank, entry);
  }

  const visibleEntries = VISUAL_ORDER.map((rank) => entryByRank.get(rank)).filter(
    (entry): entry is PodiumEntry => Boolean(entry)
  );

  if (visibleEntries.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="podium-title" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2
            id="podium-title"
            className="flex items-center gap-2 text-lg font-bold text-zinc-100"
          >
            <Crown className="h-5 w-5 text-amber-300" aria-hidden="true" />
            Podio de artistas
          </h2>
          <p className="text-xs text-zinc-500">
            Pasa el cursor sobre un artista para ver sus canciones destacadas; haz click para abrir
            su perfil completo.
          </p>
        </div>
      </div>

      <ul className="flex items-end justify-center gap-2 pt-32 sm:gap-4 sm:pt-36">
        {visibleEntries.map((entry) => {
          const theme = RANK_THEMES[entry.rank];
          const isHovered = hoveredKey === entry.artist.key;
          const previewId = `podium-preview-${entry.artist.key}`;

          return (
            <motion.li
              key={entry.artist.key}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: entry.rank * 0.08, type: 'spring', stiffness: 120, damping: 16 }}
              className={`relative flex min-w-0 flex-1 flex-col items-center ${
                entry.rank === 1
                  ? 'order-2 max-w-[15rem]'
                  : entry.rank === 2
                    ? 'order-1 max-w-[16rem]'
                    : 'order-3 max-w-[16rem]'
              }`}
              onMouseEnter={() => setHoveredKey(entry.artist.key)}
              onMouseLeave={() => setHoveredKey(null)}
              onFocus={() => setHoveredKey(entry.artist.key)}
              onBlur={() => setHoveredKey(null)}
            >
              <AnimatePresence>
                {isHovered && (
                  <motion.div
                    id={previewId}
                    role="tooltip"
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.97 }}
                    transition={{ duration: 0.16 }}
                    className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-3 w-60 max-w-[78vw] -translate-x-1/2 rounded-2xl border border-zinc-700/80 bg-zinc-950/95 p-3 text-left shadow-2xl backdrop-blur"
                  >
                    <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                      <Sparkles className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
                      Canciones destacadas
                    </p>
                    {entry.featuredTracks.length > 0 ? (
                      <ol className="mt-2 space-y-1.5">
                        {entry.featuredTracks.map((track, index) => (
                          <li
                            key={`${entry.artist.key}-${track}`}
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
                      <p className="mt-2 text-xs text-zinc-500">Sin canciones destacadas.</p>
                    )}
                    <div
                      className={`mt-2 rounded-lg px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                        entry.rank === 1
                          ? 'bg-amber-400/10 text-amber-300'
                          : 'bg-zinc-800/80 text-zinc-400'
                      }`}
                    >
                      {theme.label} puesto · {songsLabel(entry.artist.appearanceCount)}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.button
                type="button"
                onClick={() => onSelectArtist(entry.artist)}
                aria-describedby={isHovered ? previewId : undefined}
                aria-label={`Ver perfil de ${entry.artist.name}, ${theme.label} puesto, ${songsLabel(
                  entry.artist.appearanceCount
                )}`}
                whileHover={{ y: -4 }}
                whileTap={{ scale: 0.98 }}
                className={`group relative flex w-full flex-col items-center gap-2 rounded-2xl border bg-gradient-to-b from-zinc-900 to-zinc-950 p-3 text-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-white/60 sm:p-4 ${theme.cardBorder} ${theme.cardGlow}`}
              >
                <span
                  className={`absolute -top-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide shadow-lg ${theme.badgeClass} ${
                    entry.rank === 1 ? 'scale-110' : ''
                  }`}
                >
                  <span aria-hidden="true">{theme.medal}</span> {theme.label}
                </span>

                <ArtistAvatar
                  name={entry.artist.name}
                  src={entry.thumbnailUrl}
                  size={entry.rank === 1 ? 'lg' : 'md'}
                  className={theme.avatarRing}
                />

                <span className="line-clamp-2 text-sm font-bold text-zinc-50 sm:text-base">
                  {entry.artist.name}
                </span>

                <span className="inline-flex items-center gap-1 text-[11px] text-zinc-400">
                  <Music2 className="h-3 w-3" aria-hidden="true" />
                  {songsLabel(entry.artist.appearanceCount)}
                </span>

                <span className={`text-[10px] font-semibold uppercase tracking-wide ${theme.rankText}`}>
                  {theme.medalName}
                </span>
              </motion.button>

              <motion.div
                aria-hidden="true"
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ delay: 0.15 + entry.rank * 0.08, type: 'spring', stiffness: 90 }}
                className={`mt-2 flex w-full origin-bottom items-start justify-center rounded-t-xl border border-b-0 border-white/10 bg-gradient-to-t ${theme.pedestalGradient} ${theme.pedestalHeight}`}
              >
                <span className={`mt-2 text-2xl font-black sm:text-3xl ${theme.rankText}`}>
                  {entry.rank}
                </span>
              </motion.div>
            </motion.li>
          );
        })}
      </ul>
    </section>
  );
}

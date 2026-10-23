'use client';

import { useCallback, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ChevronDown,
  Disc3,
  Link2,
  ListMusic,
  Loader2,
  Music2,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';
import type { ExtractedTrack, PlatformType } from '@/types/playlist';
import type { ArtistStats, PlaylistStats, PodiumEntry } from '@/types/stats';
import { PlatformSelector, validatePlaylistUrl } from '@/components/platform-selector';
import { getDefaultPlatform, type PlatformDefinition } from '@/components/platform-selector';
import { MetricsSummary } from '@/components/metrics-summary';
import { Podium } from '@/components/podium';
import { ArtistModal } from '@/components/artist-modal';
import { RemainingArtistsPanel } from '@/components/remaining-artists-panel';
import { songsLabel } from '@/lib/format';

interface AnalyzeResponse {
  platform: PlatformType;
  playlistId: string;
  playlistTitle: string;
  totalTracks: number;
  stats: PlaylistStats;
  tracks: ExtractedTrack[];
}

interface SelectedArtist {
  artist: ArtistStats;
  rank?: PodiumEntry['rank'];
  thumbnailUrl?: string;
}

const PLATFORM_LABELS: Record<PlatformType, string> = {
  youtube_music: 'YouTube Music',
  spotify: 'Spotify',
  deezer: 'Deezer',
  soundcloud: 'SoundCloud',
};

function TrackCover({ src, title }: { src?: string; title: string }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-zinc-500">
        <Music2 className="h-4 w-4" aria-hidden="true" />
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={`Portada de ${title}`}
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-white/10"
    />
  );
}

export default function HomePage() {
  const [platform, setPlatform] = useState<PlatformDefinition>(getDefaultPlatform);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [showTracks, setShowTracks] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState<SelectedArtist | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const closeArtistModal = useCallback(() => setSelectedArtist(null), []);

  function handleSelectPlatform(nextPlatform: PlatformDefinition) {
    if (!nextPlatform.available || loading) return;
    setPlatform(nextPlatform);
    setError(null);
  }

  function handleSelectArtist(artist: ArtistStats) {
    const podiumEntry = result?.stats.podium.find((entry) => entry.artist.key === artist.key);
    setSelectedArtist({
      artist,
      rank: podiumEntry?.rank,
      thumbnailUrl: podiumEntry?.thumbnailUrl,
    });
  }

  function handleClear() {
    setUrl('');
    setError(null);
    inputRef.current?.focus();
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      setError(`Ingresa el enlace de una playlist de ${platform.name}.`);
      inputRef.current?.focus();
      return;
    }

    const validationError = validatePlaylistUrl(platform.id, trimmedUrl);
    if (validationError) {
      setError(validationError);
      inputRef.current?.focus();
      return;
    }

    setLoading(true);
    setSelectedArtist(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmedUrl }),
      });

      const payload = (await response.json().catch(() => null)) as
        | (Partial<AnalyzeResponse> & { error?: string })
        | null;

      if (!response.ok) {
        setError(
          payload?.error ??
            'No se pudo analizar la playlist. Revisa el enlace e inténtalo de nuevo.'
        );
        return;
      }

      if (!payload?.stats || !Array.isArray(payload.tracks)) {
        setError('La respuesta del servidor no contiene estadísticas válidas. Inténtalo de nuevo.');
        return;
      }

      setResult(payload as AnalyzeResponse);
      setShowTracks(false);
    } catch {
      setError(
        'No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo en unos segundos.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(52,211,153,0.10),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(251,191,36,0.08),transparent_50%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed -left-32 top-24 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed -right-32 top-1/2 h-80 w-80 rounded-full bg-amber-500/10 blur-3xl"
      />

      <main className="relative mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
        <motion.header
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-3">
            <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-zinc-950 shadow-[0_0_40px_-10px_rgba(52,211,153,0.8)]">
              <Disc3 className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-zinc-50 sm:text-3xl">
                MusicStats
              </h1>
              <p className="text-xs text-zinc-400 sm:text-sm">
                Descubre los artistas y colaboraciones de tus playlists.
              </p>
            </div>
          </div>

          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/70 px-3 py-1 text-[11px] font-medium text-zinc-400">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
            Podio Top 3 · Colaboraciones · Perfiles
          </span>
        </motion.header>

        <div className="mt-8 space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05 }}
            className="rounded-3xl border border-zinc-800 bg-zinc-900/40 p-4 backdrop-blur sm:p-5"
          >
            <PlatformSelector selected={platform.id} onSelect={handleSelectPlatform} />
          </motion.div>

          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1 }}
            aria-labelledby="analyze-form-title"
            className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-4 shadow-xl backdrop-blur sm:p-6"
          >
            <div className="mb-3">
              <h2 id="analyze-form-title" className="text-sm font-semibold text-zinc-200">
                2. Pega el enlace de tu playlist
              </h2>
              <p className="text-xs text-zinc-500">
                Analizaremos playlists públicas de{' '}
                <span className="font-medium text-zinc-300">{platform.name}</span>. No necesitas
                iniciar sesión.
              </p>
            </div>

            <form onSubmit={handleSubmit} noValidate>
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <Link2
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
                  />
                  <label htmlFor="playlist-url" className="sr-only">
                    Enlace de la playlist de {platform.name}
                  </label>
                  <input
                    ref={inputRef}
                    id="playlist-url"
                    name="url"
                    type="url"
                    inputMode="url"
                    autoComplete="off"
                    spellCheck={false}
                    value={url}
                    disabled={loading}
                    onChange={(event) => {
                      setUrl(event.target.value);
                      if (error) setError(null);
                    }}
                    placeholder={platform.placeholder}
                    aria-invalid={Boolean(error)}
                    aria-describedby="playlist-url-help"
                    className="h-12 w-full rounded-xl border border-zinc-700 bg-zinc-950/80 pl-10 pr-11 text-sm text-zinc-100 placeholder:text-zinc-600 transition-colors focus:border-emerald-400/70 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 disabled:opacity-70"
                  />
                  {url.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClear}
                      aria-label="Limpiar enlace"
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                </div>

                <motion.button
                  type="submit"
                  disabled={loading}
                  whileHover={loading ? undefined : { y: -1 }}
                  whileTap={loading ? undefined : { scale: 0.98 }}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-emerald-500 px-5 text-sm font-bold text-zinc-950 shadow-[0_0_35px_-12px_rgba(52,211,153,0.9)] transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      Analizando...
                    </>
                  ) : (
                    <>
                      <ListMusic className="h-4 w-4" aria-hidden="true" />
                      Analizar playlist
                    </>
                  )}
                </motion.button>
              </div>

              <p id="playlist-url-help" className="mt-2 text-[11px] text-zinc-500">
                Ejemplo: <span className="text-zinc-400">{platform.placeholder}</span>
              </p>

              <AnimatePresence>
                {loading && (
                  <motion.div
                    role="status"
                    aria-live="polite"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-3 py-2.5 text-xs text-emerald-200">
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
                      Extrayendo canciones y analizando estadísticas...
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </form>
          </motion.section>

          <AnimatePresence initial={false}>
            {error && (
              <motion.div
                role="alert"
                initial={{ opacity: 0, y: -8, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -8, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-950/40 p-4 text-red-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">No se pudo analizar la playlist</p>
                    <p className="mt-0.5 break-words text-xs text-red-300/90">{error}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setError(null)}
                    aria-label="Cerrar mensaje de error"
                    className="rounded-lg p-1 text-red-300/80 transition-colors hover:bg-red-900/40 hover:text-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {result && (
              <motion.div
                key={`${result.playlistId}-${result.playlistTitle}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.35 }}
                className="space-y-6"
              >
                <section
                  aria-labelledby="result-title"
                  className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-gradient-to-r from-zinc-900/90 to-zinc-900/40 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                      <Sparkles className="h-3 w-3" aria-hidden="true" />
                      Playlist analizada ·{' '}
                      {PLATFORM_LABELS[result.platform] ?? result.platform}
                    </p>
                    <h2
                      id="result-title"
                      className="mt-1 break-words text-xl font-bold text-zinc-50"
                    >
                      {result.playlistTitle}
                    </h2>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {songsLabel(result.stats.totalTracks)} ·{' '}
                      {result.stats.totalArtists.toLocaleString('es')} artistas únicos
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setResult(null);
                      setShowTracks(false);
                      setError(null);
                      setUrl('');
                      inputRef.current?.focus();
                    }}
                    className="inline-flex w-fit items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    Analizar otra playlist
                  </button>
                </section>

                <MetricsSummary stats={result.stats} onSelectArtist={handleSelectArtist} />

                <Podium podium={result.stats.podium} onSelectArtist={handleSelectArtist} />

                <div className="grid items-start gap-6 lg:grid-cols-2">
                  {result.tracks.length > 0 && (
                    <section
                      aria-labelledby="track-list-title"
                      className="rounded-2xl border border-zinc-800 bg-zinc-900/40"
                    >
                    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                      <div>
                        <h2
                          id="track-list-title"
                          className="flex items-center gap-2 text-lg font-bold text-zinc-100"
                        >
                          <ListMusic className="h-5 w-5 text-sky-300" aria-hidden="true" />
                          Lista de canciones
                        </h2>
                        <p className="text-xs text-zinc-500">
                          {songsLabel(result.tracks.length)} analizadas en esta playlist.
                        </p>
                      </div>

                      <button
                        type="button"
                        aria-expanded={showTracks}
                        aria-controls="track-list-panel"
                        onClick={() => setShowTracks((value) => !value)}
                        className="inline-flex w-fit items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-200 transition-colors hover:border-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                      >
                        {showTracks ? 'Ocultar lista' : `Ver ${songsLabel(result.tracks.length)}`}
                        <ChevronDown
                          aria-hidden="true"
                          className={`h-4 w-4 transition-transform ${
                            showTracks ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                    </div>

                    <AnimatePresence initial={false}>
                      {showTracks && (
                        <motion.div
                          id="track-list-panel"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25 }}
                          className="overflow-hidden"
                        >
                          <ol className="max-h-[32rem] space-y-1 overflow-y-auto border-t border-zinc-800 p-3 sm:p-4">
                            {result.tracks.map((track, index) => (
                              <li
                                key={`${track.id}-${index}`}
                                className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-zinc-800/40"
                              >
                                <span className="w-6 shrink-0 text-right text-[11px] font-semibold tabular-nums text-zinc-600">
                                  {index + 1}
                                </span>
                                <TrackCover
                                  src={track.thumbnailUrl ?? track.coverUrl}
                                  title={track.title}
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium text-zinc-100">
                                    {track.title}
                                  </p>
                                  <p className="truncate text-[11px] text-zinc-500">
                                    {track.allArtists.join(', ')}
                                  </p>
                                </div>
                                {track.albumName && (
                                  <span className="hidden max-w-[10rem] truncate text-[11px] text-zinc-600 md:block">
                                    {track.albumName}
                                  </span>
                                )}
                                {track.durationText && (
                                  <span className="shrink-0 text-[11px] tabular-nums text-zinc-500">
                                    {track.durationText}
                                  </span>
                                )}
                              </li>
                            ))}
                          </ol>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </section>
                  )}

                  <RemainingArtistsPanel
                    artists={result.stats.artists.slice(3)}
                    onSelectArtist={handleSelectArtist}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {!result && !loading && (
            <p className="text-center text-xs text-zinc-600">
              Pega el enlace de una playlist pública y presiona “Analizar playlist”.
            </p>
          )}
        </div>

        <footer className="mt-10 border-t border-zinc-800/70 pt-4 text-center text-[11px] text-zinc-600">
          MusicStats · Estadísticas de playlists, podio Top 3 y matriz de colaboraciones.
        </footer>
      </main>

      <ArtistModal
        artist={selectedArtist?.artist ?? null}
        rank={selectedArtist?.rank}
        thumbnailUrl={selectedArtist?.thumbnailUrl}
        onClose={closeArtistModal}
      />
    </div>
  );
}

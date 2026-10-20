'use client';

import { useMemo, useState } from 'react';
import type { ExtractorResult } from '@/types/playlist';
import { calculateMusicStats } from '@/lib/stats/calculator';

export default function HomePage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ExtractorResult | null>(null);

  // Estadísticas calculadas localmente a partir del resultado de extracción.
  const stats = useMemo(
    () => (data ? calculateMusicStats(data.tracks) : null),
    [data]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setData(null);

    if (!url.trim()) {
      setError('Ingresa un link de playlist de YouTube Music.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Error al extraer la playlist');
      } else {
        setData(json);
      }
    } catch (err: any) {
      setError(err?.message || 'Error de red al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl p-6 font-mono text-sm">
      <h1 className="mb-2 text-xl font-bold">
        MusicStats — Prueba de Extracción (YouTube Music)
      </h1>
      <p className="mb-4 text-zinc-400">
        Vista mínima de prueba: pegá el link de una playlist pública de YouTube Music o YouTube para verificar que traiga todas las canciones. Debajo del listado crudo vas a ver el artista #1 con sus colaboraciones por tema y el podio Top 3.
      </p>

      <form onSubmit={handleSubmit} className="mb-6 flex gap-2">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://music.youtube.com/playlist?list=..."
          className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-zinc-200 px-4 py-2 font-semibold text-zinc-900 disabled:opacity-50"
        >
          {loading ? 'Extrayendo...' : 'Extraer canciones'}
        </button>
      </form>

      {error && (
        <div className="mb-4 rounded border border-red-800 bg-red-950/50 p-3 text-red-300">
          Error: {error}
        </div>
      )}

      {data && (
        <div>
          <div className="mb-4 rounded border border-zinc-800 bg-zinc-900 p-3">
            <p>
              <strong>Playlist:</strong> {data.playlistTitle}
            </p>
            <p>
              <strong>ID:</strong> {data.playlistId}
            </p>
            <p>
              <strong>Total de canciones extraídas:</strong> {data.totalTracks}
            </p>
          </div>

          <ol className="space-y-1">
            {data.tracks.map((track, idx) => (
              <li
                key={`${track.id}-${idx}`}
                className="border-b border-zinc-800 py-1.5"
              >
                <span className="text-zinc-500">{idx + 1}.</span>{' '}
                <span className="font-semibold text-zinc-100">{track.title}</span>{' '}
                <span className="text-zinc-400">
                  — {track.allArtists.join(', ')}
                </span>
                {track.durationText && (
                  <span className="ml-2 text-xs text-zinc-500">
                    [{track.durationText}]
                  </span>
                )}
              </li>
            ))}
          </ol>

          <section className="mt-8 space-y-4">
            <h2 className="text-lg font-bold text-zinc-100">
              Estadísticas de la playlist
            </h2>

            {stats?.topArtist ? (
              <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
                <h3 className="mb-1 font-bold">
                  🥇 Artista #1:{' '}
                  <span className="text-emerald-400">{stats.topArtist.name}</span>
                </h3>
                <p className="mb-3 text-zinc-400">
                  Aparece en{' '}
                  <strong className="text-zinc-100">
                    {stats.topArtist.appearanceCount}
                  </strong>{' '}
                  de {stats.totalTracks} canciones (
                  {stats.topArtist.mainTrackCount} como artista principal,{' '}
                  {stats.topArtist.featuredTrackCount} como colaborador).
                </p>

                <p className="mb-1 font-semibold text-zinc-300">
                  Canciones del artista #1:
                </p>
                <ul className="space-y-1">
                  {stats.topArtist.tracks.map((t, idx) => (
                    <li
                      key={`${t.trackId}-${idx}`}
                      className="border-b border-zinc-800 py-1"
                    >
                      <span className="text-zinc-500">{idx + 1}.</span>{' '}
                      <span className="text-zinc-100">{t.trackTitle}</span>{' '}
                      <span className="text-zinc-500">
                        —{' '}
                        {t.collaborators.length > 0
                          ? `con ${t.collaborators.join(', ')}`
                          : 'sin colaboración'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-zinc-500">
                No se encontraron artistas válidos para mostrar el artista #1.
              </p>
            )}

            <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
              <h3 className="mb-2 font-bold text-zinc-100">🏆 Podio Top 3</h3>
              {stats && stats.podium.length > 0 ? (
                <ol className="space-y-1">
                  {stats.podium.map((entry) => (
                    <li
                      key={entry.artist.key}
                      className="flex items-center justify-between border-b border-zinc-800 py-1"
                    >
                      <span>
                        <span className="mr-2">
                          {entry.rank === 1
                            ? '🥇'
                            : entry.rank === 2
                              ? '🥈'
                              : '🥉'}
                        </span>
                        <span className="font-semibold text-zinc-100">
                          {entry.artist.name}
                        </span>
                      </span>
                      <span className="text-zinc-400">
                        {entry.artist.appearanceCount} canciones
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-zinc-500">Sin datos de artistas.</p>
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

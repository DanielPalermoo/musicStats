'use client'

import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { formatDuration, gradientFor } from '@/lib/musicstats/format'
import { cn } from '@/lib/utils'
import { useAnalysis } from './analysis-context'
import { ArtistAvatar, CoverArt } from './artwork'

export function ArtistSheet({ name, onClose }: { name: string | null; onClose: () => void }) {
  const { artistByName, trackById, analysis, openArtist } = useAnalysis()
  const artist = name ? artistByName.get(name) : undefined

  return (
    <Sheet open={Boolean(artist)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="scrollbar-thin w-full gap-0 overflow-y-auto border-white/10 bg-[#0d0e12] p-0 sm:max-w-md"
      >
        {artist && (
          <>
            <div className="relative h-40 shrink-0 overflow-hidden" style={{ backgroundImage: gradientFor(artist.name) }}>
              {artist.imageUrl && (
                <img
                  src={artist.imageUrl}
                  alt=""
                  aria-hidden
                  className="absolute inset-0 size-full object-cover opacity-25 blur-sm"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/30 to-[#0d0e12]" />
              <div
                aria-hidden
                className="absolute inset-0 opacity-30 mix-blend-overlay"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(90deg, rgb(255 255 255 / 0.4) 0 2px, transparent 2px 10px)',
                  maskImage: 'linear-gradient(to top, transparent, black)',
                }}
              />
            </div>
            <div className="relative -mt-14 px-5">
              <ArtistAvatar
                name={artist.name}
                imageUrl={artist.imageUrl}
                className="size-24 text-2xl"
                ring={artist.rank === 1 ? '#f59e0b' : artist.rank === 2 ? '#cbd5e1' : artist.rank === 3 ? '#d97745' : '#27272a'}
              />
              <div className="mt-3 flex items-center gap-2">
                <span className="rounded-md bg-white/5 px-2 py-0.5 text-xs font-semibold text-zinc-300 ring-1 ring-white/10">
                  #{artist.rank} en la playlist
                </span>
              </div>
              <SheetTitle className="mt-2 font-display text-2xl font-bold text-zinc-50">{artist.name}</SheetTitle>
              <SheetDescription className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {artist.name} es una de las voces que definen «{analysis.playlist.title}». Aquí tienes cada canción donde
                aparece, ya sea como artista principal o como invitado.
              </SheetDescription>
            </div>

            <dl className="mt-5 grid grid-cols-3 gap-2 px-5">
              {[
                { k: 'Total', v: artist.count, c: 'text-zinc-50' },
                { k: 'Principal', v: artist.mainCount, c: 'text-amber-400' },
                { k: 'Featuring', v: artist.featCount, c: 'text-emerald-400' },
              ].map((s) => (
                <div key={s.k} className="rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/5">
                  <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">{s.k}</dt>
                  <dd className={cn('font-display text-2xl font-bold tabular-nums', s.c)}>{s.v}</dd>
                </div>
              ))}
            </dl>

            {artist.collaborators.length > 0 && (
              <div className="mt-6 px-5">
                <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Colabora con</h3>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {artist.collaborators.map((c) => (
                    <li key={c.name}>
                      <button
                        type="button"
                        onClick={() => openArtist(c.name)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] py-0.5 pr-2.5 pl-0.5 text-xs text-zinc-200 ring-1 ring-white/10 hover:bg-white/[0.08]"
                      >
                        <ArtistAvatar name={c.name} imageUrl={artistByName.get(c.name)?.imageUrl} className="size-5 text-[8px]" />
                        {c.name}
                        <span className="text-emerald-400">{c.trackIds.length}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-6 px-5 pb-8">
              <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Canciones en la playlist
              </h3>
              <ul className="mt-2 flex flex-col gap-1">
                {artist.trackIds.map((id) => {
                  const t = trackById.get(id)
                  if (!t) return null
                  const isMain = t.artists[0] === artist.name
                  return (
                    <li key={id} className="flex items-center gap-3 rounded-xl p-2 hover:bg-white/[0.03]">
                      <CoverArt seed={t.title} imageUrl={t.coverUrl} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-zinc-100">{t.title}</p>
                        <p className="truncate text-xs text-muted-foreground">{t.artists.join(', ')}</p>
                      </div>
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                          isMain
                            ? 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/25'
                            : 'bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/20',
                        )}
                      >
                        {isMain ? 'Principal' : 'Feat.'}
                      </span>
                      <span className="w-9 text-right text-xs text-muted-foreground tabular-nums">
                        {formatDuration(t.duration)}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

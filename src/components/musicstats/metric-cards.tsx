'use client'

import { Disc3, Shuffle, Users } from 'lucide-react'
import { useAnalysis } from './analysis-context'

export function MetricCards() {
  const { analysis } = useAnalysis()
  const { stats } = analysis

  const items = [
    {
      label: 'Canciones analizadas',
      value: stats.totalTracks,
      hint: `${stats.collabTracks} con colaboraciones`,
      icon: Disc3,
      color: '#10b981',
    },
    {
      label: 'Artistas únicos',
      value: stats.uniqueArtists,
      hint: 'Entre principales y featuring',
      icon: Users,
      color: '#f59e0b',
    },
    {
      label: 'Diversidad',
      value: `${stats.diversity}%`,
      hint: `${stats.avgPerArtist} canciones por artista`,
      icon: Shuffle,
      color: '#a855f7',
      progress: stats.diversity,
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-1 [&>*:last-child]:col-span-2 sm:[&>*:last-child]:col-span-1">
      {items.map((item, i) => (
        <div
          key={item.label}
          className="glass animate-rise group relative overflow-hidden rounded-2xl p-5"
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <div
            aria-hidden
            className="absolute -top-10 -right-10 size-32 rounded-full opacity-20 blur-2xl transition-opacity group-hover:opacity-40"
            style={{ backgroundColor: item.color }}
          />
          <div className="flex items-start justify-between">
            <p className="text-sm text-muted-foreground">{item.label}</p>
            <span
              className="flex size-8 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${item.color}1a`, color: item.color }}
            >
              <item.icon className="size-4" aria-hidden />
            </span>
          </div>
          <p className="mt-2 font-display text-4xl font-bold tabular-nums tracking-tight text-zinc-50">{item.value}</p>
          {item.progress !== undefined && (
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5" aria-hidden>
              <div
                className="h-full rounded-full"
                style={{ width: `${item.progress}%`, background: `linear-gradient(90deg, ${item.color}, #f0abfc)` }}
              />
            </div>
          )}
          <p className="mt-2 text-xs text-muted-foreground">{item.hint}</p>
        </div>
      ))}
    </div>
  )
}

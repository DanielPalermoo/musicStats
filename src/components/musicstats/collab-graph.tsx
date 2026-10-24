'use client'

import { useMemo, useState } from 'react'
import type { ArtistStat, CollabEdge } from '@/lib/musicstats/types'
import { gradientFor, hashString } from '@/lib/musicstats/format'
import { cn } from '@/lib/utils'
import { useAnalysis } from './analysis-context'
import { Panel, SectionTitle } from './shared'

const W = 900
const H = 520
const PAD = 60

type Node = { id: string; x: number; y: number; r: number; artist: ArtistStat }

function layout(artists: ArtistStat[], edges: CollabEdge[]): Node[] {
  const n = artists.length
  const nodes: Node[] = artists.map((artist, i) => {
    const angle = (i / Math.max(n, 1)) * Math.PI * 2 + (hashString(artist.name) % 100) / 100
    const radius = i === 0 ? 0 : 120 + (i % 3) * 50
    return {
      id: artist.name,
      artist,
      r: 8 + Math.sqrt(artist.count) * 7,
      x: W / 2 + Math.cos(angle) * radius,
      y: H / 2 + Math.sin(angle) * radius * 0.75,
    }
  })
  const index = new Map(nodes.map((nd, i) => [nd.id, i]))
  const links = edges
    .map((e) => ({ a: index.get(e.source), b: index.get(e.target), w: e.trackIds.length }))
    .filter((l): l is { a: number; b: number; w: number } => l.a !== undefined && l.b !== undefined)

  const k = Math.sqrt((W * H) / Math.max(n, 1)) * 0.55
  for (let iter = 0; iter < 320; iter++) {
    const temp = 18 * (1 - iter / 320) + 0.5
    const dx = new Array(n).fill(0)
    const dy = new Array(n).fill(0)
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let vx = nodes[i].x - nodes[j].x
        let vy = nodes[i].y - nodes[j].y
        let d = Math.hypot(vx, vy)
        if (d < 0.01) {
          vx = 0.1
          vy = 0.1
          d = 0.14
        }
        const minD = nodes[i].r + nodes[j].r + 24
        const f = (k * k) / d + (d < minD ? (minD - d) * 4 : 0)
        dx[i] += (vx / d) * f
        dy[i] += (vy / d) * f
        dx[j] -= (vx / d) * f
        dy[j] -= (vy / d) * f
      }
    }
    for (const l of links) {
      const vx = nodes[l.a].x - nodes[l.b].x
      const vy = nodes[l.a].y - nodes[l.b].y
      const d = Math.max(Math.hypot(vx, vy), 0.01)
      const f = ((d * d) / k) * (0.6 + l.w * 0.25)
      dx[l.a] -= (vx / d) * f
      dy[l.a] -= (vy / d) * f
      dx[l.b] += (vx / d) * f
      dy[l.b] += (vy / d) * f
    }
    for (let i = 0; i < n; i++) {
      dx[i] += (W / 2 - nodes[i].x) * 0.9
      dy[i] += (H / 2 - nodes[i].y) * 1.4
      const d = Math.max(Math.hypot(dx[i], dy[i]), 0.01)
      nodes[i].x += (dx[i] / d) * Math.min(d, temp)
      nodes[i].y += (dy[i] / d) * Math.min(d, temp)
      nodes[i].x = Math.min(W - PAD, Math.max(PAD, nodes[i].x))
      nodes[i].y = Math.min(H - PAD, Math.max(PAD - 20, nodes[i].y))
    }
  }
  return nodes
}

export function CollabGraph() {
  const { analysis, openArtist, trackById } = useAnalysis()
  const [onlyCollabs, setOnlyCollabs] = useState(true)
  const [hovered, setHovered] = useState<string | null>(null)

  const artists = useMemo(
    () => (onlyCollabs ? analysis.artists.filter((a) => a.collaborators.length > 0) : analysis.artists),
    [analysis.artists, onlyCollabs],
  )
  const nodes = useMemo(() => layout(artists, analysis.edges), [artists, analysis.edges])
  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])

  const neighbors = useMemo(() => {
    if (!hovered) return null
    const set = new Set([hovered])
    for (const e of analysis.edges) {
      if (e.source === hovered) set.add(e.target)
      if (e.target === hovered) set.add(e.source)
    }
    return set
  }, [hovered, analysis.edges])

  const hoveredArtist = hovered ? nodeMap.get(hovered)?.artist : null

  return (
    <Panel aria-labelledby="graph-title" className="relative overflow-hidden p-5 md:p-6">
      <SectionTitle
        id="graph-title"
        eyebrow="Mapa de colaboraciones"
        title="Quién canta con quién"
        action={
          <div role="group" aria-label="Filtro del grafo" className="inline-flex rounded-xl bg-white/[0.04] p-1 ring-1 ring-white/10">
            {[
              { v: true, label: 'Solo con colaboraciones' },
              { v: false, label: 'Todos' },
            ].map((opt) => (
              <button
                key={opt.label}
                type="button"
                aria-pressed={onlyCollabs === opt.v}
                onClick={() => setOnlyCollabs(opt.v)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                  onlyCollabs === opt.v ? 'bg-emerald-500 text-zinc-950' : 'text-zinc-400 hover:text-zinc-100',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        }
      />

      <div className="relative mt-4 overflow-hidden rounded-xl bg-[#0b0c10] ring-1 ring-white/5">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage: 'radial-gradient(rgb(255 255 255 / 0.08) 1px, transparent 1px)',
            backgroundSize: '22px 22px',
          }}
        />
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="relative h-auto w-full"
          role="img"
          aria-label={`Grafo con ${nodes.length} artistas y ${analysis.edges.length} colaboraciones`}
        >
          <defs>
            <linearGradient id="edge" x1="0" x2="1">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
            {nodes.map((n) => (
              <clipPath key={n.id} id={`clip-${hashString(n.id)}`}>
                <circle cx={n.x} cy={n.y} r={n.r} />
              </clipPath>
            ))}
          </defs>

          <g>
            {analysis.edges.map((e) => {
              const a = nodeMap.get(e.source)
              const b = nodeMap.get(e.target)
              if (!a || !b) return null
              const active = !neighbors || (neighbors.has(e.source) && neighbors.has(e.target) && (e.source === hovered || e.target === hovered))
              const titles = e.trackIds.map((id) => trackById.get(id)?.title).join(', ')
              return (
                <line
                  key={`${e.source}-${e.target}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke="url(#edge)"
                  strokeLinecap="round"
                  strokeWidth={1.5 + e.trackIds.length * 2.2}
                  opacity={active ? 0.75 : 0.08}
                  className="transition-opacity duration-200"
                >
                  <title>{`${e.source} × ${e.target}: ${titles}`}</title>
                </line>
              )
            })}
          </g>

          <g>
            {nodes.map((n) => {
              const dim = neighbors && !neighbors.has(n.id)
              const top = n.artist.rank <= 3
              const ringColor = n.artist.rank === 1 ? '#f59e0b' : n.artist.rank === 2 ? '#cbd5e1' : n.artist.rank === 3 ? '#d97745' : 'rgba(255,255,255,0.25)'
              const [c1, c2] = gradientFor(n.id).match(/hsl\([^)]+\)/g) ?? ['#10b981', '#065f46']
              const gid = `g-${hashString(n.id)}`
              return (
                <g
                  key={n.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`${n.id}, ${n.artist.count} canciones`}
                  className="cursor-pointer outline-none transition-opacity duration-200"
                  opacity={dim ? 0.2 : 1}
                  onMouseEnter={() => setHovered(n.id)}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered(n.id)}
                  onBlur={() => setHovered(null)}
                  onClick={() => openArtist(n.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      openArtist(n.id)
                    }
                  }}
                >
                  <defs>
                    <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor={c1} />
                      <stop offset="100%" stopColor={c2} />
                    </linearGradient>
                  </defs>
                  {top && <circle cx={n.x} cy={n.y} r={n.r + 8} fill={ringColor} opacity={0.15} />}
                  <circle cx={n.x} cy={n.y} r={n.r} fill={`url(#${gid})`} stroke={ringColor} strokeWidth={top ? 2.5 : 1.2} />
                  <text
                    x={n.x}
                    y={n.y + 4}
                    textAnchor="middle"
                    className="pointer-events-none fill-white font-display font-semibold"
                    fontSize={Math.max(10, n.r * 0.55)}
                  >
                    {n.artist.count}
                  </text>
                  <text
                    x={n.x}
                    y={n.y + n.r + 16}
                    textAnchor="middle"
                    className={cn('pointer-events-none font-sans', hovered === n.id ? 'fill-white' : 'fill-zinc-400')}
                    fontSize={12}
                    fontWeight={top ? 600 : 400}
                  >
                    {n.id}
                  </text>
                </g>
              )
            })}
          </g>
        </svg>

        <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-3 rounded-lg bg-black/50 px-3 py-2 text-[11px] text-zinc-400 backdrop-blur">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-5 rounded bg-gradient-to-r from-emerald-500 to-amber-500" /> 1 canción
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-5 rounded bg-gradient-to-r from-emerald-500 to-amber-500" /> 2+
          </span>
        </div>

        {hoveredArtist && (
          <div className="pointer-events-none absolute top-3 right-3 max-w-60 rounded-xl border border-white/10 bg-zinc-950/90 p-3 text-xs backdrop-blur">
            <p className="font-display text-sm font-semibold text-zinc-50">{hoveredArtist.name}</p>
            <p className="mt-0.5 text-muted-foreground">
              {hoveredArtist.count} canciones · {hoveredArtist.collaborators.length} colaboradores
            </p>
            {hoveredArtist.collaborators.slice(0, 4).map((c) => (
              <p key={c.name} className="mt-1 truncate text-zinc-300">
                × {c.name} <span className="text-emerald-400">({c.trackIds.length})</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </Panel>
  )
}

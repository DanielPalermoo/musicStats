'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, MousePointerClick, Network, Sparkles } from 'lucide-react';
import type {
  CollaborationGraph,
  GraphEdge,
  GraphNode,
} from '@/lib/stats/graph-data';
import { getInitials, songsLabel } from '@/lib/format';

const VIEW_WIDTH = 900;
const VIEW_HEIGHT = 580;
const CENTER_X = VIEW_WIDTH / 2;
const CENTER_Y = VIEW_HEIGHT / 2 - 5;

const MAX_NODE_LABEL = 19;
const MAX_CONNECTIONS_IN_TOOLTIP = 4;
const MAX_TRACKS_IN_TOOLTIP = 5;

interface PositionedNode extends GraphNode {
  x: number;
  y: number;
  radius: number;
  degree: number;
}

interface PositionedEdge extends GraphEdge {
  key: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
}

interface GraphLayout {
  nodes: PositionedNode[];
  edges: PositionedEdge[];
  byId: Map<string, PositionedNode>;
  maxWeight: number;
}

interface CollapseButtonProps {
  expanded: boolean;
  onToggle: () => void;
}

function truncateLabel(value: string, max = MAX_NODE_LABEL): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/** Reparte los nodos en anillos concéntricos según la cantidad a mostrar. */
function splitIntoRings(total: number): number[] {
  if (total <= 8) return [total];
  if (total <= 20) {
    const inner = Math.max(1, Math.min(total - 1, Math.round(total * 0.36)));
    return [inner, total - inner];
  }
  const inner = Math.max(1, Math.round(total * 0.2));
  const middle = Math.max(1, Math.round(total * 0.34));
  return [inner, middle, Math.max(1, total - inner - middle)];
}

const RING_RADII: Record<number, Array<{ rx: number; ry: number }>> = {
  1: [{ rx: 310, ry: 198 }],
  2: [
    { rx: 188, ry: 118 },
    { rx: 342, ry: 208 },
  ],
  3: [
    { rx: 150, ry: 94 },
    { rx: 268, ry: 164 },
    { rx: 360, ry: 214 },
  ],
};

/**
 * Calcula la posición radial/armónica de cada nodo: los artistas con más
 * conexiones ocupan los anillos internos y el tamaño del nodo crece con sus
 * apariciones en la playlist.
 */
function buildLayout(graph: CollaborationGraph): GraphLayout {
  const degree = new Map<string, number>();
  for (const edge of graph.edges) {
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
  }

  const maxTrackCount = Math.max(1, ...graph.nodes.map((node) => node.trackCount));
  const radiusFor = (node: GraphNode) =>
    16 + 14 * Math.sqrt(node.trackCount / maxTrackCount);

  const positioned = new Map<string, PositionedNode>();

  if (graph.nodes.length === 1) {
    const node = graph.nodes[0];
    positioned.set(node.id, {
      ...node,
      x: CENTER_X,
      y: CENTER_Y,
      radius: radiusFor(node),
      degree: degree.get(node.id) ?? 0,
    });
  } else if (graph.nodes.length > 1) {
    const ordered = [...graph.nodes].sort((a, b) => {
      const degreeDelta = (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0);
      if (degreeDelta !== 0) return degreeDelta;
      if (b.trackCount !== a.trackCount) return b.trackCount - a.trackCount;
      return a.id.localeCompare(b.id, 'es');
    });

    const ringCounts = splitIntoRings(ordered.length);
    const radii = RING_RADII[ringCounts.length] ?? RING_RADII[1];
    let cursor = 0;

    ringCounts.forEach((count, ringIndex) => {
      const ringNodes = ordered.slice(cursor, cursor + count);
      cursor += count;
      if (ringNodes.length === 0) return;

      const { rx, ry } = radii[ringIndex];
      const isSingleRing = ringCounts.length === 1;
      // Dos nodos se alinean horizontalmente; el resto arranca arriba. Los
      // anillos externos se desfasan para evitar radios superpuestos.
      const startAngle =
        ringNodes.length === 2
          ? Math.PI
          : isSingleRing
            ? -Math.PI / 2
            : -Math.PI / 2 + ringIndex * (Math.PI / Math.max(ringNodes.length, 2));
      const step = (Math.PI * 2) / ringNodes.length;

      ringNodes.forEach((node, index) => {
        const angle = startAngle + index * step;
        positioned.set(node.id, {
          ...node,
          x: CENTER_X + Math.cos(angle) * rx,
          y: CENTER_Y + Math.sin(angle) * ry,
          radius: radiusFor(node),
          degree: degree.get(node.id) ?? 0,
        });
      });
    });
  }

  const maxWeight = Math.max(1, ...graph.edges.map((edge) => edge.weight));

  const edges: PositionedEdge[] = [];
  for (const edge of graph.edges) {
    const source = positioned.get(edge.source);
    const target = positioned.get(edge.target);
    if (!source || !target) continue;

    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const distance = Math.hypot(dx, dy) || 1;
    const startOffset = source.radius + 2;
    const endOffset = target.radius + 2;
    const ux = dx / distance;
    const uy = dy / distance;

    edges.push({
      ...edge,
      key: `${edge.source}--${edge.target}`,
      x1: source.x + ux * startOffset,
      y1: source.y + uy * startOffset,
      x2: target.x - ux * endOffset,
      y2: target.y - uy * endOffset,
      // El grosor crece de forma proporcional al peso de la colaboración.
      width: 1 + 4 * (edge.weight / maxWeight),
    });
  }

  return {
    nodes: graph.nodes
      .map((node) => positioned.get(node.id))
      .filter((node): node is PositionedNode => Boolean(node)),
    edges,
    byId: positioned,
    maxWeight,
  };
}

function GraphCollapseButton({ expanded, onToggle }: CollapseButtonProps) {
  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-controls="collaboration-graph-panel"
      onClick={onToggle}
      className="inline-flex w-fit items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-200 transition-colors hover:border-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
    >
      {expanded ? 'Ocultar grafo' : 'Ver grafo'}
      <ChevronDown
        aria-hidden="true"
        className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
      />
    </button>
  );
}

interface CollaborationGraphProps {
  graph: CollaborationGraph;
}

/**
 * Grafo interactivo de la red de colaboraciones.
 *
 * SVG puro, responsivo, con distribución radial: cada burbuja es un artista
 * (tamaño según sus apariciones) y cada línea una colaboración (grosor según
 * las canciones compartidas). Al pasar el cursor o hacer click en un nodo o
 * arista se resaltan las conexiones y se muestra un tooltip con los temas en
 * común.
 */
export function CollaborationGraph({ graph }: CollaborationGraphProps) {
  const [expanded, setExpanded] = useState(true);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredEdgeKey, setHoveredEdgeKey] = useState<string | null>(null);
  const [pinnedNodeId, setPinnedNodeId] = useState<string | null>(null);

  const layout = useMemo(() => buildLayout(graph), [graph]);

  if (graph.nodes.length === 0) return null;

  // En redes grandes los nombres se acortan más para evitar solapamientos.
  const labelLimit =
    layout.nodes.length > 36 ? 12 : layout.nodes.length > 22 ? 14 : layout.nodes.length > 12 ? 17 : 22;

  const hoveredEdge = hoveredEdgeKey
    ? layout.edges.find((edge) => edge.key === hoveredEdgeKey)
    : undefined;
  const focusNodeId = hoveredNodeId ?? (hoveredEdge ? null : pinnedNodeId);
  const focusNode = focusNodeId ? layout.byId.get(focusNodeId) : undefined;
  const focusEdge = focusNode ? undefined : hoveredEdge;

  const emphasizedNodeIds = new Set<string>();
  if (focusEdge) {
    emphasizedNodeIds.add(focusEdge.source);
    emphasizedNodeIds.add(focusEdge.target);
  } else if (focusNode) {
    emphasizedNodeIds.add(focusNode.id);
    for (const edge of layout.edges) {
      if (edge.source === focusNode.id) emphasizedNodeIds.add(edge.target);
      if (edge.target === focusNode.id) emphasizedNodeIds.add(edge.source);
    }
  }
  const hasFocus = Boolean(focusNode || focusEdge);

  const focusConnections = focusNode
    ? layout.edges
        .filter((edge) => edge.source === focusNode.id || edge.target === focusNode.id)
        .sort((a, b) => b.weight - a.weight)
        .map((edge) => {
          const otherId = edge.source === focusNode.id ? edge.target : edge.source;
          const other = layout.byId.get(otherId);
          return {
            id: otherId,
            name: other?.name ?? otherId,
            weight: edge.weight,
            tracks: edge.tracks,
          };
        })
    : [];

  const tooltipNode = focusNode;
  const tooltipEdge = focusEdge;

  function togglePinnedNode(nodeId: string) {
    setPinnedNodeId((current) => (current === nodeId ? null : nodeId));
    setHoveredEdgeKey(null);
  }

  return (
    <section
      aria-labelledby="collaboration-graph-title"
      className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40"
    >
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <h2
            id="collaboration-graph-title"
            className="flex items-center gap-2 text-lg font-bold text-zinc-100"
          >
            <Network className="h-5 w-5 text-emerald-300" aria-hidden="true" />
            Red de colaboraciones
          </h2>
          <p className="text-xs text-zinc-500">
            {layout.nodes.length === 1
              ? '1 artista conectado'
              : `${layout.nodes.length} artistas conectados`}{' '}
            · {layout.edges.length === 1 ? '1 conexión' : `${layout.edges.length} conexiones`}
          </p>
        </div>

        <GraphCollapseButton
          expanded={expanded}
          onToggle={() => setExpanded((value) => !value)}
        />
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            id="collaboration-graph-panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="border-t border-zinc-800 p-3 sm:p-4">
              <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-zinc-500">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-gradient-to-br from-emerald-300 to-emerald-600" />
                  Podio Top 3
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-gradient-to-br from-zinc-500 to-zinc-700" />
                  Otros artistas
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-0.5 w-5 rounded-full bg-emerald-400/80" />
                  Grosor = canciones compartidas
                </span>
                <span className="ml-auto hidden items-center gap-1 text-zinc-600 sm:inline-flex">
                  <MousePointerClick className="h-3.5 w-3.5" aria-hidden="true" />
                  Pasa el cursor o toca un nodo
                </span>
              </div>

              <div className="relative">
                <svg
                  viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
                  className="h-auto w-full"
                  role="img"
                  aria-label={`Grafo de colaboraciones con ${layout.nodes.length} artistas y ${layout.edges.length} conexiones`}
                  onMouseLeave={() => {
                    setHoveredNodeId(null);
                    setHoveredEdgeKey(null);
                  }}
                  onClick={() => setPinnedNodeId(null)}
                >
                  <defs>
                    <radialGradient id="collab-node-top" cx="35%" cy="30%" r="75%">
                      <stop offset="0%" stopColor="#6ee7b7" />
                      <stop offset="55%" stopColor="#10b981" />
                      <stop offset="100%" stopColor="#047857" />
                    </radialGradient>
                    <radialGradient id="collab-node-default" cx="35%" cy="30%" r="75%">
                      <stop offset="0%" stopColor="#71717a" />
                      <stop offset="65%" stopColor="#3f3f46" />
                      <stop offset="100%" stopColor="#27272a" />
                    </radialGradient>
                    <radialGradient id="collab-node-focus" cx="35%" cy="30%" r="75%">
                      <stop offset="0%" stopColor="#a7f3d0" />
                      <stop offset="60%" stopColor="#34d399" />
                      <stop offset="100%" stopColor="#059669" />
                    </radialGradient>
                    <filter
                      id="collab-node-glow"
                      x="-70%"
                      y="-70%"
                      width="240%"
                      height="240%"
                    >
                      <feGaussianBlur stdDeviation="4" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>

                  {layout.edges.map((edge) => {
                    const isActive = focusEdge
                      ? focusEdge.key === edge.key
                      : focusNode
                        ? edge.source === focusNode.id || edge.target === focusNode.id
                        : false;
                    const opacity = hasFocus ? (isActive ? 0.95 : 0.08) : 0.4;

                    return (
                      <g key={edge.key}>
                        <line
                          x1={edge.x1}
                          y1={edge.y1}
                          x2={edge.x2}
                          y2={edge.y2}
                          stroke={isActive ? '#34d399' : '#71717a'}
                          strokeWidth={isActive ? edge.width + 0.8 : edge.width}
                          strokeLinecap="round"
                          opacity={opacity}
                          style={{ transition: 'opacity 150ms ease, stroke 150ms ease' }}
                        />
                        <line
                          x1={edge.x1}
                          y1={edge.y1}
                          x2={edge.x2}
                          y2={edge.y2}
                          stroke="transparent"
                          strokeWidth={Math.max(16, edge.width + 10)}
                          strokeLinecap="round"
                          style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                          onMouseEnter={() => {
                            setHoveredEdgeKey(edge.key);
                            setHoveredNodeId(null);
                          }}
                          onMouseLeave={() => setHoveredEdgeKey(null)}
                        >
                          <title>
                            {`${layout.byId.get(edge.source)?.name ?? edge.source} × ${
                              layout.byId.get(edge.target)?.name ?? edge.target
                            }: ${songsLabel(edge.weight)}`}
                          </title>
                        </line>
                      </g>
                    );
                  })}

                  {layout.nodes.map((node) => {
                    const isEmphasized = emphasizedNodeIds.has(node.id);
                    const isFocus = focusNode?.id === node.id;
                    const dimmed = hasFocus && !isEmphasized;
                    const fill = isFocus
                      ? 'url(#collab-node-focus)'
                      : node.isTop3
                        ? 'url(#collab-node-top)'
                        : 'url(#collab-node-default)';
                    const stroke = isEmphasized || node.isTop3 ? '#6ee7b7' : '#52525b';
                    const labelFill = node.isTop3 ? '#a7f3d0' : '#d4d4d8';

                    return (
                      <g
                        key={node.id}
                        role="button"
                        tabIndex={0}
                        aria-label={`${node.name}, ${songsLabel(
                          node.trackCount
                        )} en la playlist, ${node.degree} ${
                          node.degree === 1 ? 'colaborador' : 'colaboradores'
                        }${isFocus ? '. Seleccionado' : ''}`}
                        aria-pressed={pinnedNodeId === node.id}
                        opacity={dimmed ? 0.18 : 1}
                        style={{ cursor: 'pointer', transition: 'opacity 150ms ease' }}
                        onMouseEnter={() => {
                          setHoveredNodeId(node.id);
                          setHoveredEdgeKey(null);
                        }}
                        onMouseLeave={() => setHoveredNodeId(null)}
                        onFocus={() => {
                          setHoveredNodeId(node.id);
                          setHoveredEdgeKey(null);
                        }}
                        onBlur={() => setHoveredNodeId(null)}
                        onClick={(event) => {
                          event.stopPropagation();
                          togglePinnedNode(node.id);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            togglePinnedNode(node.id);
                          }
                        }}
                      >
                        <circle
                          cx={node.x}
                          cy={node.y}
                          r={node.radius}
                          fill={fill}
                          stroke={stroke}
                          strokeWidth={isFocus ? 3 : node.isTop3 ? 2.4 : 1.6}
                          filter={isEmphasized ? 'url(#collab-node-glow)' : undefined}
                          style={{ transition: 'stroke 150ms ease' }}
                        />
                        <text
                          x={node.x}
                          y={node.y}
                          textAnchor="middle"
                          dominantBaseline="central"
                          className="pointer-events-none select-none font-bold"
                          fontSize={Math.max(10, node.radius * 0.42)}
                          fill="#fafafa"
                        >
                          {getInitials(node.name)}
                        </text>
                        <text
                          x={node.x}
                          y={node.y + node.radius + 15}
                          textAnchor="middle"
                          className="pointer-events-none select-none"
                          fontSize={11}
                          fontWeight={node.isTop3 ? 700 : 500}
                          fill={labelFill}
                          stroke="#09090b"
                          strokeWidth={3.5}
                          paintOrder="stroke"
                        >
                          {truncateLabel(node.name, labelLimit)}
                        </text>
                        <title>
                          {`${node.name} · ${songsLabel(node.trackCount)} · ${
                            node.degree
                          } ${node.degree === 1 ? 'conexión' : 'conexiones'}`}
                        </title>
                      </g>
                    );
                  })}
                </svg>

                <AnimatePresence mode="wait">
                  {tooltipNode && (
                    <motion.div
                      key={`node-tooltip-${tooltipNode.id}`}
                      role="tooltip"
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{ duration: 0.14 }}
                      className="pointer-events-none absolute z-30 w-64 max-w-[80vw] rounded-2xl border border-zinc-700/80 bg-zinc-950/95 p-3 text-left shadow-2xl backdrop-blur"
                      style={{
                        left: `${(tooltipNode.x / VIEW_WIDTH) * 100}%`,
                        top: `${(tooltipNode.y / VIEW_HEIGHT) * 100}%`,
                        transform:
                          tooltipNode.y < 150
                            ? `translate(-50%, ${tooltipNode.radius + 14}px)`
                            : 'translate(-50%, calc(-100% - 14px))',
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="min-w-0 truncate text-sm font-bold text-zinc-50">
                          {tooltipNode.name}
                        </p>
                        {tooltipNode.isTop3 && (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                            <Sparkles className="h-3 w-3" aria-hidden="true" />
                            Top 3
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] text-zinc-400">
                        {songsLabel(tooltipNode.trackCount)} en la playlist ·{' '}
                        {tooltipNode.degree}{' '}
                        {tooltipNode.degree === 1 ? 'colaborador' : 'colaboradores'}
                      </p>

                      {focusConnections.length > 0 ? (
                        <ul className="mt-2 space-y-1.5">
                          {focusConnections
                            .slice(0, MAX_CONNECTIONS_IN_TOOLTIP)
                            .map((connection) => (
                              <li
                                key={connection.id}
                                className="rounded-lg bg-zinc-900/80 px-2 py-1.5"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="min-w-0 truncate text-xs font-medium text-zinc-100">
                                    {connection.name}
                                  </span>
                                  <span className="shrink-0 text-[10px] font-semibold tabular-nums text-emerald-300">
                                    {connection.weight} en común
                                  </span>
                                </div>
                                <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-zinc-500">
                                  {connection.tracks.join(' · ')}
                                </p>
                              </li>
                            ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-xs text-zinc-500">
                          Sin colaboraciones en esta playlist.
                        </p>
                      )}

                      {focusConnections.length > MAX_CONNECTIONS_IN_TOOLTIP && (
                        <p className="mt-1.5 text-[10px] text-zinc-500">
                          +{focusConnections.length - MAX_CONNECTIONS_IN_TOOLTIP} colaboradores más
                        </p>
                      )}
                    </motion.div>
                  )}

                  {tooltipEdge && (
                    <motion.div
                      key={`edge-tooltip-${tooltipEdge.key}`}
                      role="tooltip"
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{ duration: 0.14 }}
                      className="pointer-events-none absolute z-30 w-64 max-w-[80vw] rounded-2xl border border-emerald-400/30 bg-zinc-950/95 p-3 text-left shadow-2xl backdrop-blur"
                      style={{
                        left: `${(((tooltipEdge.x1 + tooltipEdge.x2) / 2) / VIEW_WIDTH) * 100}%`,
                        top: `${(((tooltipEdge.y1 + tooltipEdge.y2) / 2) / VIEW_HEIGHT) * 100}%`,
                        transform: 'translate(-50%, calc(-100% - 10px))',
                      }}
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-300">
                        Colaboración
                      </p>
                      <p className="mt-0.5 text-sm font-bold text-zinc-50">
                        {layout.byId.get(tooltipEdge.source)?.name ?? tooltipEdge.source}
                        <span className="mx-1 text-emerald-400">×</span>
                        {layout.byId.get(tooltipEdge.target)?.name ?? tooltipEdge.target}
                      </p>
                      <p className="text-[11px] text-zinc-400">
                        {songsLabel(tooltipEdge.weight)} en común
                      </p>
                      <ol className="mt-2 space-y-1">
                        {tooltipEdge.tracks.slice(0, MAX_TRACKS_IN_TOOLTIP).map((track, index) => (
                          <li
                            key={`${track}-${index}`}
                            className="flex items-start gap-2 text-xs text-zinc-200"
                          >
                            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[9px] font-bold text-zinc-400">
                              {index + 1}
                            </span>
                            <span className="line-clamp-2">{track}</span>
                          </li>
                        ))}
                      </ol>
                      {tooltipEdge.tracks.length > MAX_TRACKS_IN_TOOLTIP && (
                        <p className="mt-1.5 text-[10px] text-zinc-500">
                          +{tooltipEdge.tracks.length - MAX_TRACKS_IN_TOOLTIP} canciones más
                        </p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

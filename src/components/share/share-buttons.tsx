'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, Download, Loader2, RotateCcw, Sparkles } from 'lucide-react';
import { toPng } from 'html-to-image';
import type { PlaylistStats } from '@/types/stats';
import { ExportCard } from './export-card';

/** Nombre de archivo solicitado para la tarjeta exportada. */
export const EXPORT_FILENAME = 'music-stats-summary.png';

/** Ancho objetivo de la imagen final en píxeles. */
export const EXPORT_TARGET_WIDTH = 1080;

export type ExportStatus = 'idle' | 'generating' | 'downloaded' | 'error';

/**
 * Calcula el factor de escala necesario para exportar la tarjeta a 1080px de
 * ancho, con límites razonables para evitar capturas gigantes o borrosas.
 */
export function computeExportPixelRatio(nodeWidth: number): number {
  if (!Number.isFinite(nodeWidth) || nodeWidth <= 0) return 3;
  return Math.min(4, Math.max(2, EXPORT_TARGET_WIDTH / nodeWidth));
}

/**
 * Dispara la descarga de una imagen a partir de su data URL.
 *
 * Se mantiene como función independiente para poder verificarla en tests y
 * reutilizarla con otros formatos de imagen.
 */
export function triggerPngDownload(
  dataUrl: string,
  filename: string = EXPORT_FILENAME,
  doc: Document = document
): void {
  const link = doc.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  link.rel = 'noopener';
  doc.body.appendChild(link);
  link.click();
  link.remove();
}

/** Dimensiones lógicas de la tarjeta antes de escalar a 1080×1920. */
const CARD_WIDTH = 360;
const CARD_HEIGHT = 640;

export interface ShareButtonsProps {
  playlistTitle: string;
  stats: PlaylistStats;
  platformLabel?: string;
}

/**
 * Panel de exportación: muestra la tarjeta visual y permite descargarla como
 * PNG de alta resolución, con estados de generación, éxito y error.
 */
export function ShareButtons({ playlistTitle, stats, platformLabel }: ShareButtonsProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(1);
  const [status, setStatus] = useState<ExportStatus>('idle');

  // La tarjeta tiene un tamaño lógico fijo para que la captura sea nítida;
  // en pantallas estrechas se reduce visualmente con un transform.
  useLayoutEffect(() => {
    const container = previewRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;

    const updateScale = () => {
      const available = container.clientWidth;
      if (available > 0) {
        setPreviewScale(Math.min(1, available / CARD_WIDTH));
      }
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  const isGenerating = status === 'generating';

  const handleDownload = useCallback(async () => {
    const node = cardRef.current;
    if (!node || isGenerating) return;

    setStatus('generating');

    try {
      const dataUrl = await toPng(node, {
        cacheBust: true,
        pixelRatio: computeExportPixelRatio(node.offsetWidth),
        backgroundColor: '#09090b',
      });

      triggerPngDownload(dataUrl);
      setStatus('downloaded');
    } catch {
      setStatus('error');
    }
  }, [isGenerating]);

  const statusMessage =
    status === 'generating'
      ? 'Estamos renderizando tu tarjeta...'
      : status === 'downloaded'
        ? `Imagen guardada como ${EXPORT_FILENAME}.`
        : status === 'error'
          ? 'No pudimos generar el PNG. Revisa tu conexión e inténtalo de nuevo.'
          : 'PNG 1080 × 1920 listo para compartir en tus redes.';

  return (
    <section
      aria-labelledby="share-title"
      className="rounded-3xl border border-zinc-800 bg-zinc-900/40 p-4 backdrop-blur sm:p-5"
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <div className="mx-auto w-full max-w-[360px] lg:mx-0 lg:shrink-0">
          <div
            ref={previewRef}
            className="overflow-hidden"
            style={{ height: CARD_HEIGHT * previewScale }}
          >
            <div
              style={{
                width: CARD_WIDTH,
                height: CARD_HEIGHT,
                transform: `scale(${previewScale})`,
                transformOrigin: 'top left',
              }}
            >
              <ExportCard
                ref={cardRef}
                playlistTitle={playlistTitle}
                stats={stats}
                platformLabel={platformLabel}
              />
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-300">
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            Compartir
          </p>
          <h2
            id="share-title"
            className="mt-1 text-xl font-black tracking-tight text-zinc-50"
          >
            Comparte tu resumen
          </h2>
          <p className="mt-1 max-w-md text-xs leading-relaxed text-zinc-500">
            Descarga una tarjeta vertical con tu artista #1, el podio Top 3 y las métricas
            principales de la playlist.
          </p>

          <button
            type="button"
            onClick={handleDownload}
            disabled={isGenerating}
            aria-busy={isGenerating}
            className={`mt-4 inline-flex h-11 w-full max-w-xs items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:cursor-wait ${
              status === 'downloaded'
                ? 'border border-emerald-400/40 bg-emerald-400/10 text-emerald-200'
                : status === 'error'
                  ? 'border border-red-400/40 bg-red-400/10 text-red-200 hover:bg-red-400/15'
                  : 'bg-gradient-to-r from-emerald-400 to-emerald-500 text-zinc-950 shadow-[0_0_35px_-12px_rgba(52,211,153,0.9)] hover:from-emerald-300 hover:to-emerald-400'
            }`}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Generando imagen...
              </>
            ) : status === 'downloaded' ? (
              <>
                <Check className="h-4 w-4" aria-hidden="true" />
                ¡Descargado!
              </>
            ) : status === 'error' ? (
              <>
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Reintentar descarga
              </>
            ) : (
              <>
                <Download className="h-4 w-4" aria-hidden="true" />
                Descargar resumen
              </>
            )}
          </button>

          <p
            role={status === 'error' ? 'alert' : 'status'}
            aria-live="polite"
            className={`mt-2 flex items-start gap-1.5 text-xs ${
              status === 'error'
                ? 'text-red-300'
                : status === 'downloaded'
                  ? 'text-emerald-300'
                  : 'text-zinc-500'
            }`}
          >
            {status === 'error' && (
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            )}
            <span>{statusMessage}</span>
          </p>
        </div>
      </div>
    </section>
  );
}

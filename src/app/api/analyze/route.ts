import { NextResponse } from 'next/server';
import { YouTubeMusicExtractor } from '@/lib/extractors/youtube-music';
import { calculateMusicStats } from '@/lib/stats/calculator';
import type { PlaylistExtractor } from '@/types/playlist';

/**
 * Extractores disponibles mientras no exista el PlatformRegistry (tarea 2.5).
 * Cuando el registro esté implementado, basta con reemplazar esta lista por
 * los adaptadores que exponga el registro.
 */
const availableExtractors: PlaylistExtractor[] = [new YouTubeMusicExtractor()];

/** Palabras clave (en minúsculas) que indican playlist privada, eliminada o inexistente. */
const NOT_FOUND_KEYWORDS = [
  'privada',
  'privado',
  'private',
  'no encontrada',
  'no encontrado',
  'not found',
  'no existe',
  'does not exist',
  'unavailable',
  'no disponible',
  'no se encontraron canciones',
  'http 404',
];

/** Errores típicos de red/timeout que deben reportarse como fallo del servidor. */
const NETWORK_ERROR_PATTERN =
  /fetch failed|network|enotfound|econnrefused|econnreset|etimedout|eai_again|socket hang up|timed? ?out/i;

function parseHttpUrl(value: string): URL | null {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed;
  } catch {
    return null;
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '';
}

function isNotFoundError(message: string): boolean {
  const normalized = message.toLowerCase();
  return NOT_FOUND_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const code = (error as { code?: string }).code;
  if (
    error.name === 'AbortError' ||
    error.name === 'TimeoutError' ||
    (typeof code === 'string' &&
      ['ENOTFOUND', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN'].includes(code))
  ) {
    return true;
  }

  return NETWORK_ERROR_PATTERN.test(error.message);
}

/**
 * POST /api/analyze
 *
 * Recibe `{ url }`, detecta la plataforma, extrae la playlist y devuelve las
 * estadísticas calculadas junto con las pistas originales.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'El cuerpo de la solicitud no es un JSON válido.' },
      { status: 400 }
    );
  }

  const rawUrl =
    typeof body === 'object' && body !== null && 'url' in body
      ? (body as { url?: unknown }).url
      : undefined;
  const url = typeof rawUrl === 'string' ? rawUrl.trim() : '';

  if (!url) {
    return NextResponse.json(
      { error: 'Debes ingresar una URL de playlist.' },
      { status: 400 }
    );
  }

  if (!parseHttpUrl(url)) {
    return NextResponse.json(
      {
        error:
          'La URL ingresada no es válida. Verifica que sea un enlace completo que empiece por http:// o https://.',
      },
      { status: 400 }
    );
  }

  const extractor = availableExtractors.find((candidate) => candidate.canHandle(url));
  if (!extractor) {
    return NextResponse.json(
      {
        error:
          'La plataforma de este enlace no está soportada o no corresponde a una playlist. Por ahora puedes analizar playlists públicas de YouTube / YouTube Music (debe incluir ?list=...).',
      },
      { status: 400 }
    );
  }

  try {
    const result = await extractor.extract(url);
    const stats = calculateMusicStats(result.tracks);

    return NextResponse.json({
      platform: result.platform,
      playlistId: result.playlistId,
      playlistTitle: result.playlistTitle,
      totalTracks: result.totalTracks,
      stats,
      tracks: result.tracks,
    });
  } catch (error: unknown) {
    console.error('[POST /api/analyze] Error:', error);
    const message = getErrorMessage(error);

    if (isNotFoundError(message)) {
      return NextResponse.json(
        {
          error:
            'No pudimos encontrar la playlist. Verifica que el enlace sea correcto y que la playlist sea pública (no privada).',
        },
        { status: 404 }
      );
    }

    if (isNetworkError(error)) {
      return NextResponse.json(
        {
          error:
            'No pudimos conectar con la plataforma de la playlist. Revisa tu conexión e inténtalo de nuevo.',
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        error:
          'Ocurrió un error inesperado al analizar la playlist. Inténtalo de nuevo en unos segundos.',
      },
      { status: 500 }
    );
  }
}

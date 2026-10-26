import { NextResponse } from 'next/server';
import { platformRegistry } from '@/lib/extractors/registry';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const url = typeof body?.url === 'string' ? body.url.trim() : '';

    if (!url) {
      return NextResponse.json(
        { error: 'Debes ingresar una URL de playlist.' },
        { status: 400 }
      );
    }

    const extractor = platformRegistry.getExtractor(url);
    if (!extractor) {
      return NextResponse.json(
        {
          error:
            'Por ahora aceptamos URLs de playlists públicas de Spotify, YouTube / YouTube Music, Deezer, SoundCloud y Tidal.',
        },
        { status: 400 }
      );
    }

    const result = await extractor.extract(url);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[POST /api/extract] Error:', err);
    return NextResponse.json(
      {
        error:
          err?.message ||
          'Ocurrió un error inesperado al extraer las canciones de la playlist.',
      },
      { status: 500 }
    );
  }
}

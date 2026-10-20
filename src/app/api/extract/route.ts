import { NextResponse } from 'next/server';
import { YouTubeMusicExtractor } from '@/lib/extractors/youtube-music';

const ytExtractor = new YouTubeMusicExtractor();

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

    if (!ytExtractor.canHandle(url)) {
      return NextResponse.json(
        {
          error:
            'Por ahora estamos probando únicamente URLs de playlists de YouTube / YouTube Music (debe incluir ?list=...).',
        },
        { status: 400 }
      );
    }

    const result = await ytExtractor.extract(url);
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

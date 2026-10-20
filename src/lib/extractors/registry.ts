import { ExtractorResult, PlaylistExtractor } from '@/types/playlist';
import { SpotifyExtractor } from './spotify';
import { YouTubeMusicExtractor } from './youtube-music';

/**
 * Registro modular de adaptadores de plataformas.
 *
 * Permite resolver la plataforma a partir de la URL y añadir nuevos
 * extractores (Deezer, SoundCloud, Apple Music, etc.) sin tocar el resto
 * de la lógica de extracción ni el motor de estadísticas.
 */
export class PlatformRegistry {
  private readonly extractors: PlaylistExtractor[] = [];

  /**
   * Registra (o reemplaza, si ya existe la misma plataforma) un extractor.
   */
  register(extractor: PlaylistExtractor): this {
    const index = this.extractors.findIndex((item) => item.platform === extractor.platform);
    if (index >= 0) {
      this.extractors[index] = extractor;
    } else {
      this.extractors.push(extractor);
    }
    return this;
  }

  /**
   * Devuelve una copia de los extractores registrados (útil para catálogos de UI).
   */
  getExtractors(): PlaylistExtractor[] {
    return [...this.extractors];
  }

  /**
   * Devuelve el extractor capaz de manejar la URL, o null si no hay ninguno.
   */
  getExtractor(url: string): PlaylistExtractor | null {
    for (const extractor of this.extractors) {
      if (extractor.canHandle(url)) return extractor;
    }
    return null;
  }

  /**
   * Resuelve la plataforma y extrae la playlist.
   */
  async extract(url: string): Promise<ExtractorResult> {
    const extractor = this.getExtractor(url);
    if (!extractor) {
      throw new Error(
        'La URL no corresponde a una plataforma soportada. Por ahora aceptamos playlists de Spotify y YouTube Music.'
      );
    }

    return extractor.extract(url);
  }
}

export const platformRegistry = new PlatformRegistry()
  .register(new YouTubeMusicExtractor())
  .register(new SpotifyExtractor());

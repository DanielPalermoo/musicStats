// @vitest-environment jsdom
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('html-to-image', () => ({
  toPng: vi.fn(),
}));

import { toPng } from 'html-to-image';
import type { ArtistStats, PlaylistStats } from '@/types/stats';
import { ExportCard } from '@/components/share/export-card';
import {
  EXPORT_FILENAME,
  ShareButtons,
  computeExportPixelRatio,
} from '@/components/share/share-buttons';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const toPngMock = vi.mocked(toPng);

function makeArtist(
  key: string,
  name: string,
  appearanceCount: number,
  mainTrackCount = appearanceCount
): ArtistStats {
  return {
    key,
    name,
    appearanceCount,
    mainTrackCount,
    featuredTrackCount: appearanceCount - mainTrackCount,
    tracks: [],
    collaborations: [],
  };
}

const topArtist = makeArtist('bad-bunny', 'Bad Bunny', 12, 9);
const secondArtist = makeArtist('karol-g', 'Karol G', 8, 6);
const thirdArtist = makeArtist('rauw', 'Rauw Alejandro', 5, 4);

const stats: PlaylistStats = {
  totalTracks: 42,
  totalArtists: 18,
  topArtist,
  podium: [
    {
      rank: 1,
      artist: topArtist,
      featuredTracks: ['Tití Me Preguntó'],
      thumbnailUrl: 'https://example.com/bad-bunny.jpg',
    },
    { rank: 2, artist: secondArtist, featuredTracks: ['Provenza'] },
    { rank: 3, artist: thirdArtist, featuredTracks: ['Todo de Ti'] },
  ],
  artists: [topArtist, secondArtist, thirdArtist],
};

const emptyStats: PlaylistStats = {
  totalTracks: 0,
  totalArtists: 0,
  topArtist: null,
  podium: [],
  artists: [],
};

const baseProps = {
  playlistTitle: 'Verano 2026',
  stats,
  platformLabel: 'Spotify',
};

describe('ExportCard', () => {
  afterEach(() => {
    cleanup();
  });

  it('renderiza el título, las métricas y los créditos de MusicStats', () => {
    const { container } = render(createElement(ExportCard, baseProps));

    expect(screen.getByText('Verano 2026')).toBeDefined();
    expect(screen.getByText('Canciones')).toBeDefined();
    expect(screen.getByText('42')).toBeDefined();
    expect(screen.getByText('Artistas')).toBeDefined();
    expect(screen.getByText('18')).toBeDefined();
    expect(screen.getByText('Spotify')).toBeDefined();
    expect(screen.getByRole('img', { name: /Resumen exportable de la playlist Verano 2026/ })).toBeDefined();
    expect(container.textContent).toContain('Creado con');
    expect(container.textContent).toContain('MusicStats');
  });

  it('destaca al artista #1 con su cantidad de apariciones', () => {
    render(createElement(ExportCard, baseProps));

    expect(screen.getByText('Artista #1')).toBeDefined();
    expect(screen.getByText('Destacado')).toBeDefined();
    expect(screen.getAllByText('Bad Bunny').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Aparece en 12 canciones')).toBeDefined();
    expect(screen.getByText('9 como artista principal')).toBeDefined();
  });

  it('muestra el podio Top 3 con medallas, artistas y colores por posición', () => {
    render(createElement(ExportCard, baseProps));

    expect(screen.getByText('Podio Top 3')).toBeDefined();
    expect(screen.getByLabelText('Medalla de Oro')).toBeDefined();
    expect(screen.getByLabelText('Medalla de Plata')).toBeDefined();
    expect(screen.getByLabelText('Medalla de Bronce')).toBeDefined();
    expect(screen.getByText('Oro')).toBeDefined();
    expect(screen.getByText('Plata')).toBeDefined();
    expect(screen.getByText('Bronce')).toBeDefined();
    expect(screen.getByText('Karol G')).toBeDefined();
    expect(screen.getByText('Rauw Alejandro')).toBeDefined();
  });

  it('tolera playlists sin artistas ni podio', () => {
    render(
      createElement(ExportCard, {
        playlistTitle: 'Playlist vacía',
        stats: emptyStats,
      })
    );

    expect(screen.getByText('Playlist vacía')).toBeDefined();
    expect(screen.getByText('Sin artistas válidos en esta playlist.')).toBeDefined();
    expect(
      screen.getByText('No hay suficientes artistas para armar el podio.')
    ).toBeDefined();
    expect(screen.getByText('Resumen')).toBeDefined();
  });
});

describe('computeExportPixelRatio', () => {
  it('escala la tarjeta hasta 1080px de ancho con límites seguros', () => {
    expect(computeExportPixelRatio(360)).toBe(3);
    expect(computeExportPixelRatio(320)).toBeGreaterThan(3);
    expect(computeExportPixelRatio(900)).toBe(2);
    expect(computeExportPixelRatio(100)).toBe(4);
    expect(computeExportPixelRatio(0)).toBe(3);
  });
});

describe('ShareButtons', () => {
  let clickedLink: HTMLAnchorElement | null = null;

  beforeEach(() => {
    toPngMock.mockReset();
    clickedLink = null;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      clickedLink = this;
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('genera el PNG y dispara la descarga con el nombre esperado', async () => {
    toPngMock.mockResolvedValue('data:image/png;base64,AAAA');

    render(createElement(ShareButtons, baseProps));
    fireEvent.click(screen.getByRole('button', { name: /Descargar resumen/ }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /¡Descargado!/ })).toBeDefined();
    });

    expect(toPngMock).toHaveBeenCalledTimes(1);

    const [node, options] = toPngMock.mock.calls[0];
    expect((node as HTMLElement).getAttribute('aria-label')).toContain(
      'Resumen exportable de la playlist Verano 2026'
    );
    expect(options).toMatchObject({
      backgroundColor: '#09090b',
      pixelRatio: 3,
    });
    expect(clickedLink?.download).toBe(EXPORT_FILENAME);
    expect(clickedLink?.href).toContain('data:image/png;base64,AAAA');
    expect(
      screen.getByText(`Imagen guardada como ${EXPORT_FILENAME}.`)
    ).toBeDefined();
  });

  it('muestra el estado "Generando" con el botón deshabilitado mientras captura', async () => {
    let resolveExport: ((value: string) => void) | undefined;
    toPngMock.mockReturnValue(
      new Promise<string>((resolve) => {
        resolveExport = resolve;
      })
    );

    render(createElement(ShareButtons, baseProps));
    fireEvent.click(screen.getByRole('button', { name: /Descargar resumen/ }));

    const generatingButton = screen.getByRole('button', { name: /Generando imagen/ });
    expect((generatingButton as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Estamos renderizando tu tarjeta...')).toBeDefined();

    resolveExport?.('data:image/png;base64,BBBB');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /¡Descargado!/ })).toBeDefined();
    });
  });

  it('muestra el estado de error y permite reintentar la descarga', async () => {
    toPngMock.mockRejectedValueOnce(new Error('No se pudo capturar la tarjeta'));

    render(createElement(ShareButtons, baseProps));
    fireEvent.click(screen.getByRole('button', { name: /Descargar resumen/ }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
    });

    expect(screen.getByRole('alert').textContent).toContain('No pudimos generar el PNG');
    expect(clickedLink).toBeNull();

    const retryButton = screen.getByRole('button', { name: /Reintentar descarga/ });
    expect((retryButton as HTMLButtonElement).disabled).toBe(false);

    toPngMock.mockResolvedValue('data:image/png;base64,CCCC');
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /¡Descargado!/ })).toBeDefined();
    });

    expect(toPngMock).toHaveBeenCalledTimes(2);
    expect(clickedLink?.download).toBe(EXPORT_FILENAME);
  });
});

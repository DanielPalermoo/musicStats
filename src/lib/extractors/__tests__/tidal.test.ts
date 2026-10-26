import { afterEach, describe, expect, it, vi } from 'vitest';
import { TidalExtractor } from '@/lib/extractors/tidal';

const PLAYLIST_ID = '94fe2b9b-096d-4b39-8129-d5b8e774e9b3';

function jsonResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  };
}

describe('TidalExtractor', () => {
  const extractor = new TidalExtractor();

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('canHandle & extractPlaylistId', () => {
    it('reconoce URLs válidas de Tidal con browse o listen', () => {
      const urls = [
        `https://tidal.com/browse/playlist/${PLAYLIST_ID}`,
        `https://listen.tidal.com/playlist/${PLAYLIST_ID}`,
        `https://tidal.com/playlist/${PLAYLIST_ID}`,
        `http://listen.tidal.com/playlist/${PLAYLIST_ID}?si=123`,
      ];

      for (const url of urls) {
        expect(extractor.canHandle(url)).toBe(true);
        expect(extractor.extractPlaylistId(url)).toBe(PLAYLIST_ID);
      }
    });

    it('rechaza URLs de otras plataformas o malformadas', () => {
      expect(extractor.canHandle('https://open.spotify.com/playlist/123')).toBe(false);
      expect(extractor.canHandle('https://tidal.com/album/12345')).toBe(false);
      expect(extractor.canHandle('https://tidal.com/browse/playlist/not-a-uuid')).toBe(false);
      expect(extractor.extractPlaylistId('https://tidal.com/browse/playlist/invalid')).toBeNull();
    });
  });

  describe('extract', () => {
    it('extrae metadatos y tracks correctamente', async () => {
      const mockMeta = {
        title: 'Rock Hits',
        numberOfTracks: 2,
      };

      const mockItems = {
        items: [
          {
            item: {
              id: 101,
              title: 'Song One',
              duration: 210,
              artist: { name: 'Main Artist' },
              artists: [{ name: 'Main Artist' }, { name: 'Featured Artist' }],
              album: {
                title: 'Greatest Album',
                cover: 'd718c081-ef6d-4694-bb3f-953c0d31c1cc',
              },
            },
          },
          {
            item: {
              id: 102,
              title: 'Song Two',
              duration: 180,
              artist: { name: 'Solo Artist' },
              artists: [{ name: 'Solo Artist' }],
              album: {
                title: 'Solo Album',
                cover: null,
              },
            },
          },
        ],
        totalNumberOfItems: 2,
      };

      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string) => {
          if (url.includes('/items?')) {
            return jsonResponse(mockItems);
          }
          return jsonResponse(mockMeta);
        })
      );

      const result = await extractor.extract(`https://tidal.com/browse/playlist/${PLAYLIST_ID}`);

      expect(result.platform).toBe('tidal');
      expect(result.playlistId).toBe(PLAYLIST_ID);
      expect(result.playlistTitle).toBe('Rock Hits');
      expect(result.totalTracks).toBe(2);
      expect(result.tracks).toHaveLength(2);

      const [first, second] = result.tracks;
      expect(first.title).toBe('Song One');
      expect(first.mainArtist).toBe('Main Artist');
      expect(first.allArtists).toEqual(['Main Artist', 'Featured Artist']);
      expect(first.durationMs).toBe(210000);
      expect(first.durationText).toBe('3:30');
      expect(first.coverUrl).toBe(
        'https://resources.tidal.com/images/d718c081/ef6d/4694/bb3f/953c0d31c1cc/640x640.jpg'
      );
      expect(first.albumName).toBe('Greatest Album');

      expect(second.title).toBe('Song Two');
      expect(second.mainArtist).toBe('Solo Artist');
      expect(second.coverUrl).toBeUndefined();
    });

    it('maneja error 404 de playlist no encontrada o privada', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({}, 404)));

      await expect(
        extractor.extract(`https://tidal.com/browse/playlist/${PLAYLIST_ID}`)
      ).rejects.toThrow('La playlist de Tidal no fue encontrada o es privada.');
    });
  });
});

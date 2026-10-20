export type PlatformType = 'youtube_music' | 'spotify';

export interface ExtractedTrack {
  id: string;
  title: string;
  mainArtist: string;
  allArtists: string[];
  thumbnailUrl?: string;
  durationText?: string;
  durationMs?: number;
  coverUrl?: string;
  albumName?: string;
}

export interface ExtractorResult {
  platform: PlatformType;
  playlistId: string;
  playlistTitle: string;
  totalTracks: number;
  tracks: ExtractedTrack[];
}

export interface PlaylistExtractor {
  readonly platform: PlatformType;
  canHandle(url: string): boolean;
  extractPlaylistId(url: string): string | null;
  extract(url: string): Promise<ExtractorResult>;
}

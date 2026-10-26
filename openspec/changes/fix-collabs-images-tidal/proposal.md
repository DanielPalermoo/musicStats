# Proposal

## Why

In production, two significant usability issues and one feature gap were identified:
1. Song titles in Spanish containing the conjunction "y" (e.g. "Toco Y Me Voy") are incorrectly parsed as collaborations, creating phantom artists (such as "Me Voy") and incorrectly marking tracks as `FEAT.`.
2. Artist avatars and track artworks only render synthetic CSS gradients with initials, discarding available cover and thumbnail URLs from extractors.
3. Users cannot analyze playlists from Tidal, limiting platform coverage compared to Spotify, YouTube Music, Deezer, and SoundCloud.

Resolving these issues ensures accurate artist statistics, restores real visual artwork across the UI, and expands music platform compatibility to Tidal.

## What Changes

- **Collaboration Normalizer Fix**: Prevent bare letters "y" and "x" from being treated as collaboration triggers outside of parentheses in track titles. Retain collaboration splitting only within explicit collaboration contexts (such as `(feat. A y B)` or in explicit multi-artist credits).
- **Artwork & Image Rendering**:
  - Propagate `coverUrl` and `thumbnailUrl` from extractors to `Track` and `ArtistStat` entities.
  - Update `ArtistAvatar` and `CoverArt` in `src/components/musicstats/artwork.tsx` to display actual images when available, gracefully falling back to CSS gradients and initials on load error or absence.
  - Configure `next.config.mjs` with remote image patterns for Deezer, SoundCloud, and Tidal.
- **Tidal Platform Integration**:
  - Implement `TidalExtractor` supporting `https://tidal.com/browse/playlist/[uuid]` and `https://listen.tidal.com/playlist/[uuid]`.
  - Register `'tidal'` in `PlatformType`, `PlatformId`, the API route `/api/extract`, and the `PlatformSelector` UI.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `music-stats-analysis`: Update title collaboration extraction rules so bare conjunctions in titles do not split track titles into artists.
- `interactive-ui`: Display real cover and artist imagery in podium, track lists, and cards with resilient fallback to initials/gradients.
- `playlist-extraction`: Add Tidal playlist URL detection, track listing, and metadata extraction.

## Impact

- **Core Stats**: `src/lib/stats/normalizer.ts` and test suite.
- **Data Adapters & Types**: `src/lib/musicstats/adapter.ts`, `src/lib/musicstats/types.ts`, `src/types/playlist.ts`.
- **UI Components**: `src/components/musicstats/artwork.tsx`, `src/components/platform-selector.tsx`, podium and sheet components.
- **Next.js Config**: `next.config.mjs` image domains.
- **Extractors**: New extractor `src/lib/extractors/tidal.ts`.

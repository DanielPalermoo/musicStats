# Design

## Context

MusicStats processes playlists from multiple streaming services and computes artist metrics and collaboration networks.
- Collaboration detection relies on regex matching in `src/lib/stats/normalizer.ts`. Currently `COLLAB_KEYWORDS_SOURCE` treats `\b(?:featuring|feat|ft|with|vs|x|y)\b\.?` as triggers everywhere, causing false positives on common words like Spanish "y" (e.g. "Toco Y Me Voy").
- The UI layer (`src/components/musicstats/artwork.tsx`) was refactored during UI modernisation to use purely algorithmic CSS gradients with initials (`initials(...)`, `gradientFor(...)`), discarding track thumbnails and album covers forwarded by extractors.
- Tidal playlists can be parsed via public endpoints / open Web API endpoints without user OAuth login (matching Spotify public fallback and YouTube Music).

## Goals / Non-Goals

**Goals:**
- Eliminate false positives where song titles with "y" / "x" without explicit feat indicators create fake artist profiles.
- Restore visual covers in track rows, artist cards, and podium with graceful error handling.
- Provide a robust `TidalExtractor` following the established `PlaylistExtractor` interface with full URL resolution and pagination support.
- Maintain 100% test pass rate and clean Next.js build.

**Non-Goals:**
- Changing the share card URL codec serialization format (share links continue using existing schemas).
- Modifying Deezer or YouTube Music extraction pipelines beyond remote image host configuration.
- Requiring paid Tidal developer accounts or OAuth login for end-users.

## Decisions

### 1. Title Collaboration Extraction Refinement
- **Decision:** Split collaboration parsing into two distinct regex sets:
  - `BARE_TITLE_COLLAB_REGEX`: Only explicit keywords (`\b(?:featuring|feat|ft|with|prod\.?)\b`) can trigger collaboration slicing outside parentheses/brackets in bare titles.
  - `ENCLOSED_COLLAB_REGEX`: Inside parentheses or brackets (e.g. `(feat. A y B)` or `[with X & Y]`), `y`, `x`, `&`, and commas remain valid artist delimiters.
  - In `extractCollaborators` (artist string field), `y` and `&` continue to separate multiple artists when they are listed in the artist metadata.
- **Alternative considered:** Completely removing "y". Rejected because Spanish collaboration credits frequently use "y" (e.g., "Duki y Bizarrap").

### 2. Artwork and Image Component Architecture
- **Decision:** Extend `Track` in `types.ts` with `coverUrl?: string` and `ArtistStat` with `imageUrl?: string`. Update `ArtistAvatar` and `CoverArt` in `src/components/musicstats/artwork.tsx` to accept `imageUrl?: string`.
  - Use standard HTML `<img>` with `loading="lazy"`, `decoding="async"`, and `onError` fallback state that sets a `hasError` boolean to render the existing gradient + initials markup seamlessly.
  - In `next.config.mjs`, register wildcard patterns for Deezer (`**.dzcdn.net`), SoundCloud (`**.sndcdn.com`), and Tidal (`**.tidal.com`, `resources.tidal.com`).
- **Alternative considered:** Next.js `<Image />` component. Rejected for arbitrary external third-party CDN domains to avoid build-time whitelisting bottlenecks and CORS/optimization overhead on edge functions; standard `<img>` with lazy loading and onError fallback is lighter and more resilient.

### 3. Tidal Extractor Design
- **Decision:** Implement `src/lib/extractors/tidal.ts` conforming to `PlaylistExtractor`:
  - Recognizes URLs containing `tidal.com/browse/playlist/` and `listen.tidal.com/playlist/` and extracts the UUID.
  - Queries Tidal public API / hydration endpoint (or Tidal open API v1 `https://api.tidal.com/v1/playlists/[id]/items` or web player JSON) to extract title, tracks, artists, duration, and album cover art (`https://resources.tidal.com/images/[image-id]/640x640.jpg`).
  - Integrates into `src/app/api/extract/route.ts` and `src/components/platform-selector.tsx` with Tidal brand colors and SVG icon.

## Risks / Trade-offs

- **[Tidal API rate limits or changes]** → Mitigation: Extract playlist metadata with appropriate User-Agent headers and graceful error reporting matching the existing Deezer and SoundCloud patterns.
- **[Broken image URLs from external CDNs]** → Mitigation: Resilient `onError` state in `ArtistAvatar` and `CoverArt` instantly falls back to the CSS generative gradient and initials without visual glitches.
- **[Complex song titles with unusual punctuation]** → Mitigation: Dedicated unit test suite with tricky titles in Spanish and English ("Toco Y Me Voy", "Amor y Control", "This & That", "Artist A feat. Artist B").

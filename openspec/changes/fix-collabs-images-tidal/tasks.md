# Tasks

## 1. Collaboration Parser Normalization

- [x] 1.1 Refactor bare title collaboration regex in `src/lib/stats/normalizer.ts` so "y" and "x" are not treated as collaboration triggers in bare song titles outside parentheses/brackets, verifying with unit tests.
- [x] 1.2 Preserve collaboration separation using "y", "x", "&", and commas within explicit enclosed contexts `(...)` / `[...]` and in multi-artist metadata strings, verifying existing collaboration tests pass.
- [x] 1.3 Add test cases in `src/lib/stats/__tests__/normalizer.test.ts` for Spanish titles with conjunctions ("Toco Y Me Voy", "Amor y Control", "Lluvia y fuego") and verify `npx vitest run src/lib/stats/__tests__/normalizer.test.ts` passes.

## 2. Artwork & Image Support

- [x] 2.1 Update data contracts in `src/lib/musicstats/types.ts` to add `coverUrl?: string` to `Track` and `imageUrl?: string` to `ArtistStat`.
- [x] 2.2 Propagate `t.thumbnailUrl` / `t.coverUrl` in `src/lib/musicstats/adapter.ts` and set artist image from the primary track thumbnail, verifying with `npm test`.
- [x] 2.3 Refactor `ArtistAvatar` and `CoverArt` in `src/components/musicstats/artwork.tsx` to accept `imageUrl?: string`, render `<img>` with lazy loading and onError fallback to existing generative CSS gradients and initials.
- [x] 2.4 Wire `imageUrl` and `coverUrl` into `podium.tsx`, `top-artist-card.tsx`, `artist-sheet.tsx`, `results-header.tsx`, and `exploration-panels.tsx`.
- [x] 2.5 Update `next.config.mjs` with remote image patterns for Deezer (`**.dzcdn.net`), SoundCloud (`**.sndcdn.com`), and Tidal (`**.tidal.com`, `resources.tidal.com`).

## 3. Tidal Platform Integration

- [x] 3.1 Implement `TidalExtractor` in `src/lib/extractors/tidal.ts` conforming to `PlaylistExtractor` to parse Tidal playlist URLs (`tidal.com/browse/playlist/...` and `listen.tidal.com/playlist/...`), fetch playlist metadata, and return normalized `ExtractedTrack` entries.
- [x] 3.2 Register `'tidal'` in `src/types/playlist.ts` (`PlatformType`), `src/lib/musicstats/types.ts` (`PlatformId`), `src/lib/musicstats/adapter.ts`, and the extraction route `src/app/api/extract/route.ts`.
- [x] 3.3 Add Tidal platform card, brand SVG icon, URL validator, and sample link in `src/components/platform-selector.tsx`.
- [x] 3.4 Add unit tests for `TidalExtractor` in `src/lib/extractors/__tests__/tidal.test.ts` and verify with `npx vitest run src/lib/extractors/__tests__/tidal.test.ts`.

## 4. Verification and Validation

- [x] 4.1 Run full test suite with `npm test` and verify 100% test pass rate.
- [x] 4.2 Run production build with `npm run build` and verify clean Next.js compilation without TypeScript errors.

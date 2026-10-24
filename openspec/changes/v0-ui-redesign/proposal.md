# Proposal: Rediseño Visual v0 (Layout Fluido, Podio Olímpico, Story Card & Artist Sheet)

## Why
El MVP y las características post-MVP establecieron un motor estadístico sólido y soporte multiplataforma completo. Para llevar la experiencia de usuario a un nivel moderno y visualmente atractivo, se diseñó una nueva interfaz en v0 con:
1. Layout fluido oscuro con acentos de color por plataforma y estilo glassmorphism.
2. Podio olímpico interactivo (Top 3) con medallas, animaciones y visualización destacada de canciones.
3. Modal de Story Card (`StoryCardDialog`) optimizado para compartir en historias/redes sociales.
4. Panel lateral deslizable del artista (`ArtistSheet`) para explorar apariciones y colaboradores de un artista individual.
5. Grafo de colaboraciones integrado en la nueva estética visual.

## What Changes
- **Dependencias de UI:** Se incorporan dependencias necesarias para las primitivas de diseño: `swr`, `sonner`, `@base-ui/react`, `class-variance-authority`, `next-themes`.
- **Primitivas de Componentes UI:** Componentes base accesibles y estilizados: `button.tsx`, `dialog.tsx`, `hover-card.tsx`, `sheet.tsx`, `sonner.tsx`, y la utilidad `cn` en `src/lib/utils.ts`.
- **Estilos Globales:** Variables semánticas de color para plataformas (Spotify, YouTube, Deezer, SoundCloud), podio (oro, plata, bronce), fondo oscuro, utilidades de glassmorphism y animación de equalizer.
- **Adaptador de Datos (`src/lib/musicstats/adapter.ts`):** Mapper que transforma la respuesta de nuestro backend (`POST /api/analyze`) al formato de tipos `PlaylistAnalysis` de v0, permitiendo que la nueva interfaz consuma datos reales sin tocar los extractores.
- **Componentes del Dashboard:** Migración e integración de todos los componentes modulares (`site-header`, `search-hero`, `results-header`, `metric-cards`, `top-artist-card`, `podium`, `collab-graph`, `exploration-panels`, `artist-sheet`, `story-card-dialog`, `artwork`).
- **Página Principal (`src/app/page.tsx`):** Integración con `MusicStatsApp` alimentado por el backend real y compatible con enlaces compartidos.

## Capabilities

### Modified Capabilities
- `interactive-ui`: Reemplaza la vista preliminar por el nuevo diseño completo v0 (podio olímpico, story card dialog, panel lateral artist sheet, tarjetas de métricas y grafo integrado).

## Impact
- **Nuevas dependencias:** `swr`, `sonner`, `@base-ui/react`, `class-variance-authority`, `next-themes`.
- **Extractores:** Intactos y 100% preservados.
- **Tests:** Se mantienen los 156 tests existentes y se agregan tests unitarios para el adaptador.

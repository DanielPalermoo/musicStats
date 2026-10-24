# Tasks: Rediseño Visual v0

## 1. Primitivas de UI y Dependencias (Worker 1: feature/ui-primitives-and-deps)

- [x] 1.1 Instalar dependencias en `musicStats`: `npm install swr sonner @base-ui/react class-variance-authority next-themes`.
- [x] 1.2 Migrar función de utilidad `cn` en `src/lib/utils.ts`.
- [x] 1.3 Migrar primitivas de UI desde `musicStats-ui/v0/components/ui/` hacia `src/components/ui/` (`button.tsx`, `dialog.tsx`, `hover-card.tsx`, `sheet.tsx`, `sonner.tsx`).
- [x] 1.4 Configurar variables CSS, temas y utilidades (`glass`, `@theme`, colores de plataformas y podio, keyframes) en `src/app/globals.css`.
- [x] 1.5 Verificar compilación limpia de las primitivas de interfaz (`npm run build` / tsc check).

## 2. Adaptador de Datos Backend a v0 (Worker 2: feature/ui-data-adapter)

- [x] 2.1 Importar tipos y formatos de v0 (`src/lib/musicstats/types.ts`, `src/lib/musicstats/format.ts`, `src/lib/musicstats/platforms.ts`).
- [x] 2.2 Diseñar e implementar `src/lib/musicstats/adapter.ts`: función `adaptAnalyzeResponse` que convierte la respuesta de `POST /api/analyze` (`PlaylistStats`, `Track[]`, metadata) en `PlaylistAnalysis`.
- [x] 2.3 Desarrollar suite de pruebas unitarias exhaustivas en `src/lib/musicstats/__tests__/adapter.test.ts` verificando conteos, podio, colaboradores y aristas del grafo.
- [x] 2.4 Verificar que el 100% de los 156 tests existentes continúen pasando sin regresiones (`npm run test`).

## 3. Integración del Dashboard y Página Principal (Worker 3: feature/ui-dashboard-integration)

- [x] 3.1 Migrar componentes visuales desde `musicStats-ui/v0/components/musicstats/` a `src/components/musicstats/` (`artwork.tsx`, `platform-icon.tsx`, `dashboard-skeleton.tsx`, `analysis-context.tsx`, `site-header.tsx`, `search-hero.tsx`, `results-header.tsx`, `metric-cards.tsx`, `top-artist-card.tsx`, `podium.tsx`, `collab-graph.tsx`, `exploration-panels.tsx`, `artist-sheet.tsx`, `story-card-dialog.tsx`, `shared.tsx`, `music-stats-app.tsx`).
- [x] 3.2 Integrar el fetcher cliente y/o soporte en `/api/analyze` para alimentar `MusicStatsApp` con datos reales mediante el `adapter`.
- [x] 3.3 Conectar `src/app/page.tsx` para renderizar `MusicStatsApp` con soporte para query params (`?share=...`).
- [x] 3.4 Verificar ejecución de `npm run test` y `npm run build` con código de salida 0.

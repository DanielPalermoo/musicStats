# Design: Rediseño Visual v0

## Arquitectura de la Solución

```
                    ┌────────────────────────────────────────┐
                    │            POST /api/analyze           │
                    │  (Spotify, YT Music, Deezer, SC)       │
                    └───────────────────┬────────────────────┘
                                        │
                                        ▼ (Backend response)
                          { platform, playlistTitle, stats, tracks }
                                        │
                                        ▼
                    ┌────────────────────────────────────────┐
                    │       src/lib/musicstats/adapter.ts    │
                    │         (adaptAnalyzeResponse)         │
                    └───────────────────┬────────────────────┘
                                        │
                                        ▼ (PlaylistAnalysis)
                    ┌────────────────────────────────────────┐
                    │             MusicStatsApp              │
                    │     (AnalysisProvider & Context)       │
                    └───────┬────────────────────────┬───────┘
                            │                        │
             ┌──────────────┴──────────────┐         └───────────────────┐
             ▼                             ▼                             ▼
    Podium & TopArtist              CollabGraph                ArtistSheet & Dialog
  (Podio Olímpico Top 3)     (Interactivo de Red)           (Detalle y Story Card)
```

## Estrategia de Ramas e Integración
- **Ramas:**
  1. `feature/ui-primitives-and-deps`: Worker 1
  2. `feature/ui-data-adapter`: Worker 2
  3. `feature/ui-dashboard-integration`: Worker 3
- **Integración:** Supervisada paso a paso integrando a `main` tras validar que no se toquen extractores y que los tests y build se mantengan verdes.

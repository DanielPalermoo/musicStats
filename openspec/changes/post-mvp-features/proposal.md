# Proposal: Post-MVP Features (Export & Share, Nuevos Extractores, Red de Colaboraciones)

## Why
Tras el lanzamiento y consolidación exitosa del MVP con Spotify y YouTube Music, la plataforma necesita evolucionar en tres ejes fundamentales demandados por los usuarios:
1. **Viralidad y Retención:** Posibilidad de exportar y descargar una tarjeta visual tipo "Music Wrapped" en alta calidad (PNG/SVG) y generar enlaces directos compartibles sin recalcular la playlist.
2. **Ampliación de Plataformas:** Habilitar Deezer y SoundCloud en el catálogo de extractores activos para cubrir usuarios fuera del ecosistema Spotify/YouTube.
3. **Exploración de Datos:** Visualizar las relaciones musicales mediante un gráfico interactivo de red de colaboraciones que revele la química y fuerza de unión entre artistas de la playlist.

## What Changes
- **Exportación en Imagen (PNG/SVG):** Componente dedicado `ExportCard` optimizado para captura visual (estilo Instagram Story / Wrapped) con botón de descarga instantánea usando `html-to-image`.
- **Enlaces Compartibles (Shareable Links):** Utilidad de codificación/compresión para volcar el resumen estadístico o los parámetros de playlist en la URL, permitiendo carga instantánea al abrir el enlace compartido.
- **Nuevos Extractores de Streaming:**
  - `DeezerExtractor`: Consumo directo de la API pública de Deezer (`https://api.deezer.com/playlist/{id}`) con paginación y manejo de errores.
  - `SoundCloudExtractor`: Resolución de URLs de sets/playlists públicas de SoundCloud mediante scraping o endpoints públicos sin requerir auth de usuario.
  - Activación de Deezer y SoundCloud en `PlatformRegistry` y en `PlatformSelector`.
- **Grafo de Red de Colaboraciones:**
  - Transformador de datos estadísticos a nodos (artistas) y aristas (canciones compartidas y peso de colaboración).
  - Componente `CollaborationGraph` interactivo y responsivo con renderizado SVG/Canvas fluido.

## Capabilities

### Modified Capabilities
- `playlist-extraction`: Se incorporan los requerimientos para la extracción y parsing de playlists públicas de Deezer y SoundCloud mediante sus adaptadores correspondientes.
- `interactive-ui`: Se incorporan los requerimientos para la exportación visual de tarjetas en PNG/SVG, hidratación desde URLs compartibles, visualización de la red interactiva de colaboraciones y activación de Deezer y SoundCloud en el selector de plataformas.

## Impact
- **Nuevas Dependencias:** `html-to-image` (o equivalente ligero) para captura en cliente.
- **APIs y Rutas:** Extensión del resolver de plataformas en `/api/extract` y `/api/analyze` para Deezer y SoundCloud.
- **UI:** Nuevas secciones en la vista de resultados (`ExportCard`, `ShareButtons`, `CollaborationGraph`) y lectura de query params en `page.tsx`.
- **Tests:** Nuevas suites de pruebas unitarias para los 2 nuevos extractores, la codificación de URLs y la generación de datos del grafo.

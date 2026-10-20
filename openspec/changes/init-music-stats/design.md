# Design: MusicStats MVP

## Context

El proyecto se inicia desde cero en Node.js. No cuenta con base de datos inicial y opera bajo un modelo *stateless* por petición, procesando los enlaces de playlists de Spotify y YouTube Music para entregar métricas visuales inmediatas. Para más detalles sobre motivación y alcance, consultar [proposal.md](file:///c:/Users/danip/Desktop/Proyectos%20Personales/musicStats/openspec/changes/init-music-stats/proposal.md).

## Goals / Non-Goals

**Goals:**
- Implementar una arquitectura limpia y extensible con el patrón Adapter (`PlaylistExtractor`) para soportar Spotify y YouTube Music en primera instancia, y poder agregar Deezer o SoundCloud sin modificar la lógica de negocio.
- Extraer playlists de YouTube Music de hasta 1000+ canciones de forma rápida y sin requerir API keys de Google mediante paginación HTTP con continuation tokens (InnerTube).
- Extraer playlists de Spotify utilizando credenciales opcionales de Spotify Developer con fallback automático a token público.
- Procesar canciones reconociendo colaboraciones múltiples estructuradas y en texto (`feat.`, `ft.`, `with`, `&`, `x`).
- Proveer una interfaz moderna en Dark Mode con Next.js y Tailwind CSS, podio visual interactivo (hover con top 3 y modal detallado en click).

**Non-Goals:**
- No incluye autenticación de usuarios ni login social en este MVP (se reservó explícitamente para una fase posterior).
- No incluye persistencia en base de datos ni historial guardado de búsquedas en esta iteración.
- No incluye reproducción de audio ni control de streaming dentro de la app.

## Decisions

### 1. Stack tecnológico: Next.js (App Router) + TypeScript + Tailwind CSS
- **Decisión**: Usar Next.js como framework fullstack unificado.
- **Alternativas consideradas**: Express/Fastify separado de un cliente Vite.
- **Razón**: Permite tener la lógica de backend (API routes en Node.js para scraping y llamadas a APIs) y los componentes de UI interactivos en un único proyecto, compartiendo tipos de TypeScript y simplificando el despliegue.

### 2. Patrón Adapter para la extracción de playlists
- **Decisión**: Crear una interfaz unificada `PlaylistExtractor`:
  ```typescript
  interface ExtractedTrack {
    id: string;
    title: string;
    mainArtist: string;
    allArtists: string[];
    thumbnailUrl?: string;
  }
  interface ExtractorResult {
    platform: 'spotify' | 'youtube_music';
    playlistTitle: string;
    totalTracks: number;
    tracks: ExtractedTrack[];
  }
  ```
- **Razón**: Desacopla por completo la plataforma fuente del motor estadístico.

### 3. Extracción de YouTube Music mediante InnerTube HTTP Continuations
- **Decisión**: Consumir directamente los endpoints web públicos de YouTube (`browse` con `continuationToken`) vía llamadas HTTP estándar (`fetch`), emulando el cliente web interno.
- **Alternativas consideradas**: Google YouTube Data API v3 (rechazada por límites de cuota y fricción de configuración) o Puppeteer (rechazado por alto consumo de RAM y lentitud).
- **Razón**: Es extremadamente ligero, no requiere navegador headless y procesa listas de 1000 canciones en pocos segundos.

### 4. Extracción de Spotify con enfoque híbrido
- **Decisión**: Usar Client Credentials oficial si existen variables en `.env` (`SPOTIFY_CLIENT_ID` y `SPOTIFY_CLIENT_SECRET`), y fallback automático a obtención de token anónimo web si no están presentes.
- **Razón**: Garantiza fiabilidad total si el usuario configura sus credenciales, pero no bloquea la experiencia si se prueba sin `.env`.

### 5. Motor de Colaboraciones y Normalización
- **Decisión**: Limpiar los títulos de canciones mediante expresiones regulares para detectar invitados (`(feat. X)`, `[ft. Y]`, `x Z`), combinándolos con la lista de artistas del proveedor.
- **Razón**: Muchas canciones en YouTube Music no tienen metadatos de artistas separados y los ponen en el título del video.

### 6. Animaciones y Componentes de UI: Tailwind CSS + Framer Motion
- **Decisión**: Utilizar componentes desacoplados con Tailwind CSS para el tema oscuro y Framer Motion para las transiciones del podio (1°, 2°, 3° lugar), tooltip/popover en hover y apertura de modal.

## Risks / Trade-offs

- **[Riesgo] Cambios en la API interna de YouTube (InnerTube)**:
  - *Mitigación*: Encapsular los selectores del JSON de respuesta en helpers dedicados y aislar la lógica en el adaptador.
- **[Riesgo] Playlists gigantes (>1500 canciones) y latencia**:
  - *Mitigación*: Poner un tope configurable de seguridad (ej. 1500 pistas) y emitir feedback de progreso o respuestas con stream si fuera necesario.
- **[Riesgo] Detección de falsos positivos en nombres de artistas con 'x' o '&'**:
  - *Mitigación*: Priorizar los metadatos estructurados oficiales siempre que existan, y usar expresiones regulares estrictas delimitadas por espacios para ` x `, ` & `, ` feat. `.

## Migration Plan

La arquitectura actual es stateless. Para la futura fase de usuarios y persistencia:
1. Las estructuras de datos `ExtractedTrack` y `PlaylistStatsResult` están diseñadas como DTOs planos.
2. Bastará con inyectar un servicio de persistencia (ej. Prisma + SQLite/Postgres) en la API route antes de retornar la respuesta.

# Design: Post-MVP Features (Export, Share, Extractors y Red de Colaboraciones)

## Context
El sistema cuenta con un motor analítico (`calculator.ts`), extractores para Spotify y YouTube Music (`PlatformRegistry`) y una UI modular en Next.js App Router con Tailwind y Framer Motion. Para soportar las 3 nuevas áreas en paralelo sin colisiones, desacoplamos la arquitectura en cuatro subsistemas independientes que pueden ser desarrollados por ramas aisladas.

## Goals / Non-Goals

**Goals:**
- Generar tarjetas descargables de alta fidelidad visual en el cliente (PNG/SVG) sin requerir backend headless ni Puppeteer.
- Permitir compartir el análisis completo mediante URLs autocontenidas y decodificables sin base de datos ni storage en la nube.
- Integrar Deezer y SoundCloud como proveedores de primer nivel dentro de `PlatformRegistry`.
- Renderizar un grafo interactivo de relaciones y fuerza de colaboraciones basado en SVG puro o Canvas ligero sin bibliotecas pesadas.
- Mantener cobertura de tests unitarios del 100% sobre todos los módulos nuevos.

**Non-Goals:**
- Almacenamiento persistente en base de datos externa (PostgreSQL, Redis, etc.) para links compartidos; se resuelve mediante estado autocontenido en URL.
- Soporte para playlists privadas de SoundCloud o Deezer que requieran login OAuth del usuario final.

## Decisions

### Decisión 1: Captura de Imagen en Cliente con `html-to-image`
- **Enfoque:** Usar la biblioteca `html-to-image` para capturar el nodo DOM `ExportCard` en PNG/SVG directamente en el navegador del usuario.
- **Alternativas consideradas:**
  - *Generación con `@vercel/og` / Satori en API route:* Limitado en estilos Tailwind complejos y animaciones, y dependiente de edge runtime.
  - *Puppeteer en backend:* Alto consumo de memoria y latencia innecesaria.
- **Detalle:** La tarjeta tiene dimensiones fijas optimizadas para stories (1080x1920 escalada o relación 9:16) y versión cuadrada para feed (1080x1080).

### Decisión 2: Enlaces Compartibles con Codificación Base64URL Compacta
- **Enfoque:** Diseñar `src/lib/share/url-codec.ts` para serializar un payload compacto del resumen estadístico (o la URL de la playlist analizada) en Base64URL seguro para la barra de direcciones (`?share=...`).
- **Alternativas consideradas:**
  - *URL con ID en base de datos:* Requiere infraestructura de persistencia (Supabase/Postgres) que complejiza el despliegue estático.
  - *Guardar en localStorage:* No permite compartir con terceros.
- **Detalle:** Si el payload excede el límite recomendado (~2KB), se almacena la firma compacta de la playlist para rehidratación inmediata o re-fetch silencioso.

### Decisión 3: Arquitectura de Extractores Deezer y SoundCloud
- **Enfoque:**
  - `DeezerExtractor`: Consumo directo de `https://api.deezer.com/playlist/{id}` (formato JSON público sin token), con resolución de paginación (`next` URL) y extracción de artistas y covers.
  - `SoundCloudExtractor`: Resolución de la URL pública del set/playlist mediante endpoints públicos de la API v2 o scraping de metadatos embebidos en el HTML del widget público.
  - Ambos implementan la interfaz común `PlaylistExtractor` y se registran en `PlatformRegistry`.

### Decisión 4: Visualización del Grafo de Colaboraciones en SVG
- **Enfoque:** Implementar un generador de datos de red `graph-data.ts` que calcule nodos (artistas) y enlaces ponderados (canciones colaboradas). El componente `collaboration-graph.tsx` renderiza un SVG interactivo con layout radial o de fuerzas simple, con tooltips y realce de aristas al hacer hover sobre los nodos.
- **Alternativas consideradas:**
  - *Cytoscape.js o Vis.js:* Gran peso en bundle (>300KB) y renderizado no acorde al tema oscuro de Tailwind.
  - *SVG propio con layout algorítmico:* Menor a 15KB, control total de estilos, transiciones fluidas con Framer Motion.

## Risks / Trade-offs

- **[CORS o límites en miniaturas al exportar con `html-to-image`]:**
  - *Mitigación:* Usar avatares locales o proxies/placeholders seguros cuando las imágenes externas bloqueen `canvas.toBlob`.
- **[Longitud de URL en playlists muy masivas]:**
  - *Mitigación:* Comprimir claves en el JSON antes de codificar en Base64 (`{ t: totalTracks, a: artists.slice(0, 10) }`).
- **[Cambios en endpoints no oficiales de SoundCloud]:**
  - *Mitigación:* Manejo defensivo de errores y fallbacks estructurados similares a los de YouTube Music.

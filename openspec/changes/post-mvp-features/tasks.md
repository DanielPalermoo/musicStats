# Tasks: Post-MVP Features

## 1. Exportación de Tarjeta Visual en Imagen (Worker 1: feature/export-card-image)

- [x] 1.1 Instalar e integrar `html-to-image` como dependencia de producción para captura del DOM en cliente.
- [x] 1.2 Implementar el componente visual `ExportCard` (`src/components/share/export-card.tsx`) optimizado con proporción de tarjeta story/resumen (estilo Music Wrapped), incluyendo avatar, medallas del podio Top 3, artista #1 y métricas generales.
- [x] 1.3 Implementar botones de acción y control `ShareButtons` (`src/components/share/share-buttons.tsx`) con trigger "Descargar imagen resumen" y manejo de estados (generando, descargado, error).
- [x] 1.4 Agregar tests unitarios en `src/components/share/__tests__/export-card.test.ts` y validar que `npm run test` y `npm run build` compilen sin errores.

## 2. Enlaces Compartibles y Estado en URL (Worker 2: feature/shareable-links)

- [x] 2.1 Diseñar e implementar el códec de serialización/deserialización compacta `src/lib/share/url-codec.ts` con soporte Base64URL y compresión de campos estadísticos esenciales.
- [x] 2.2 Integrar la lectura de query params en `src/app/page.tsx` para hidratar automáticamente los resultados estadísticos cuando el usuario ingresa mediante un enlace compartido (`?share=...`).
- [x] 2.3 Agregar botón "Copiar enlace para compartir" con feedback visual (tooltip de copiado al portapapeles) en la barra de acciones.
- [x] 2.4 Agregar tests unitarios para `src/lib/share/__tests__/url-codec.test.ts` cubriendo serialización, deserialización, manejo de strings corruptos y límites de tamaño, verificando `npm run test` y `npm run build`.

## 3. Nuevos Extractores: Deezer & SoundCloud (Worker 3: feature/extractors-deezer-soundcloud)

- [x] 3.1 Implementar `DeezerExtractor` (`src/lib/extractors/deezer.ts`) con parsing de URLs de Deezer, consumo de la API pública `https://api.deezer.com/playlist/{id}` con paginación y manejo de errores (404, privadas).
- [x] 3.2 Implementar `SoundCloudExtractor` (`src/lib/extractors/soundcloud.ts`) con resolución de enlaces de sets/playlists públicas, extracción de pistas y manejo de errores.
- [x] 3.3 Registrar ambos adaptadores en `src/lib/extractors/registry.ts` y habilitar sus tarjetas interactivas como activas en `src/components/platform-selector.tsx`.
- [x] 3.4 Crear suites de tests unitarios `src/lib/extractors/__tests__/deezer.test.ts` y `src/lib/extractors/__tests__/soundcloud.test.ts` con fetch mockeado y verificar que `npm run test` y `npm run build` pasen al 100%.

## 4. Grafo de Red de Colaboraciones (Worker 4: feature/collaboration-network-graph)

- [x] 4.1 Implementar generador de datos de red `src/lib/stats/graph-data.ts` que calcule nodos (artistas) y aristas (relaciones de colaboración ponderadas por canciones compartidas).
- [x] 4.2 Construir componente interactivo `CollaborationGraph` (`src/components/collaboration-graph.tsx`) con SVG responsivo, distribución de nodos, grosor de líneas proporcional y realce visual en hover.
- [x] 4.3 Integrar el panel del grafo en `src/app/page.tsx` como visualización complementaria colapsable/expandible en el dashboard de resultados.
- [x] 4.4 Agregar suite de tests unitarios para `src/lib/stats/__tests__/graph-data.test.ts` verificando cálculo de matriz de adyacencia, nodos aislados y peso de enlaces, asegurando `npm run test` y `npm run build` limpios.

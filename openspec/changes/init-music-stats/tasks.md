# Tasks: MusicStats MVP

## 1. Project Setup & Scaffolding

- [x] 1.1 Inicializar proyecto Next.js con TypeScript, App Router y Tailwind CSS, y verificar que `npm run build` ejecute sin errores.
- [x] 1.2 Instalar dependencias esenciales (`lucide-react`, `framer-motion`, `clsx`, `tailwind-merge`) y configurar variables de entorno en `.env.example`.
- [x] 1.3 Configurar tema base Dark Mode con estilos globales acordados y verificar renderizado de página inicial.

## 2. Extractor de Playlists (Adapters) & Prueba Inicial

- [x] 2.1 Definir contratos de tipos e interfaces unificadas (`PlaylistExtractor`, `ExtractedTrack`, `ExtractorResult`) en `src/types/playlist.ts`.
- [x] 2.2 Implementar adaptador de YouTube Music (`YouTubeMusicExtractor`) consumiendo InnerTube HTTP con resolución de continuaciones, verificando paginación de canciones sin requerir API key.
- [x] 2.3 Crear ruta inicial `POST /api/extract` y vista mínima de prueba (input simple sin diseño + listado crudo de canciones) para validar la extracción de YouTube Music en el navegador.
- [x] 2.4 Implementar adaptador de Spotify (`SpotifyExtractor`) con autenticación Client Credentials y fallback anónimo, verificando extracción con una playlist pública de prueba.
- [x] 2.5 Implementar registro y dispatcher/factory modular de plataformas (`PlatformRegistry`) que gestione los adaptadores actuales y permita registrar nuevas plataformas en el futuro.

## 3. Motor de Estadísticas y Colaboraciones

- [x] 3.1 Implementar normalizador de artistas y títulos para extraer colaboradores estructurados y expresiones regex (`feat.`, `ft.`, `with`, `&`, `x`), verificando con casos de prueba unitarios.
- [x] 3.2 Desarrollar calculador estadístico (`calculateMusicStats`) que determine total de pistas, artista más repetido, listado de canciones y matriz de colaboradores.
- [x] 3.3 Implementar ordenamiento de podio Top 3 de artistas (resolviendo empates y seleccionando hasta 3 canciones destacadas por artista).

## 4. API Route & Backend

- [x] 4.1 Crear endpoint `POST /api/analyze` que reciba la URL de la playlist, valide la entrada y retorne las estadísticas en JSON.
- [x] 4.2 Agregar manejo de errores descriptivos (URL inválida, playlist privada o no encontrada, error de red) con códigos HTTP adecuados.

## 5. Interfaz de Usuario y Componentes Interactivos

- [x] 5.1 Construir catálogo/selector dinámico de plataformas con tarjetas interactivas (boxes) configurables (YouTube, Spotify, y placeholders extensibles para Deezer, SoundCloud y futuras adiciones).
- [x] 5.2 Construir sección de resumen con métricas clave (total canciones, tarjeta del artista #1 y lista desplegable de colaboradores).
- [x] 5.3 Construir el podio visual animado (`Podium`) para el Top 3 con estética de medallas/colores (oro, plata, bronce).
- [x] 5.4 Implementar popover/modal en hover para los artistas del podio que liste hasta 3 canciones del artista.
- [x] 5.5 Implementar modal detallado al hacer click en el perfil del artista con su foto, nombre y la totalidad de canciones en las que participa.
- [ ] 5.6 Implementar hover/popover en los colaboradores de la tarjeta del Artista #1 (`metrics-summary.tsx`) mostrando las canciones compartidas.
- [ ] 5.7 Crear componente `remaining-artists-panel.tsx` para el ranking de artistas a partir del 4° puesto, ubicado en paralelo a la lista de canciones en un layout de 2 columnas, con botón de colapso/despliegue, hover de canciones y apertura de modal.

## 6. Testing Automatizado y Verificación Integral

- [x] 6.1 Configurar harness de pruebas unitarias con `vitest` y crear suite de tests para `src/lib/stats/normalizer.ts` y `src/lib/stats/calculator.ts`.
- [ ] 6.2 Probar y validar de punta a punta el flujo con playlists de Spotify (con Client Credentials y fallback anónimo, errores de privadas/inexistentes).
- [ ] 6.3 Probar y validar de punta a punta el flujo con playlists de YouTube Music de más de 100 temas para asegurar paginación continua sin errores.

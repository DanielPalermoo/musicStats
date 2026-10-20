# Proposal: MusicStats MVP (Playlist Analysis & Podium)

## Why

Los usuarios suelen compartir y escuchar playlists en diversas plataformas (como Spotify y YouTube Music), pero estas plataformas no ofrecen herramientas visuales rápidas para entender la composición de la lista: quién es el artista predominante, qué otros artistas colaboraron con él y en qué temas, o cuál es el podio de los 3 artistas con más presencia.
Esta propuesta inicia el proyecto `musicStats` como una aplicación web moderna en Node.js (Next.js) que permite ingresar el enlace de una playlist pública, procesar sus canciones y metadatos al vuelo (stateless), y presentar un análisis visual interactivo con podio animado, mini-listas en hover y vista detallada por artista.

## What Changes

- **Setup inicial del proyecto Next.js**: Configuración con App Router, TypeScript, Tailwind CSS y soporte de Dark Mode nativo.
- **Módulo de extracción de playlists (`playlist-extraction`)**: Arquitectura extensible con adaptadores para Spotify (Web API Client Credentials con fallback anónimo) y YouTube Music (InnerTube HTTP con paginación por continuation tokens, sin requerir API keys).
- **Motor de análisis estadístico (`music-stats-analysis`)**: Algoritmo para normalizar títulos y artistas (soporte de `feat.`, `ft.`, `with`, `&`, `x`), conteo de apariciones, detección de colaboraciones del artista principal y ordenamiento para podio Top 3.
- **Interfaz de usuario interactiva (`interactive-ui`)**:
  - Barra de búsqueda con auto-detección de plataforma (Spotify vs YouTube Music).
  - Estado de carga y feedback visual durante la extracción.
  - Tarjetas de resumen (total de canciones, artista más frecuente y lista de canciones/colaboradores).
  - Podio visual interactivo (Top 3 artistas):
    - Hover: popover/modal minilista con hasta 3 canciones del artista.
    - Click: modal completo con perfil del artista (foto + nombre) y todas las canciones donde aparece.

## Capabilities

### New Capabilities
- `playlist-extraction`: Extracción unificada y agnóstica de canciones y metadatos desde playlists públicas de Spotify y YouTube Music.
- `music-stats-analysis`: Procesamiento y cálculo de métricas: conteo de pistas, artista más repetido, matriz de colaboraciones y ranking ponderado por apariciones.
- `interactive-ui`: Experiencia de usuario web en tema oscuro con barra de análisis, podio animado Top 3, popover al hacer hover y modal detallado al hacer click.

### Modified Capabilities
<!-- None, este es un proyecto nuevo (greenfield). -->

## Impact

- **Código nuevo**: Proyecto completo en raíz con Next.js (App Router), componentes React y endpoints API en `/api/analyze`.
- **Dependencias**: Next.js, React, Tailwind CSS, Lucide React (íconos), Framer Motion (animaciones de podio/modales).
- **APIs externas**: Endpoints públicos de Spotify y YouTube Music (sin requerir obligatoriamente API keys para comenzar a probar).
- **Persistencia**: Ninguna para el MVP (arquitectura stateless en memoria, desacoplada y lista para integrar persistencia/auth en futuras iteraciones).

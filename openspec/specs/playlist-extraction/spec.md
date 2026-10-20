# playlist-extraction Specification

## Purpose
Permite extraer pistas y metadatos de playlists públicas de música (Spotify y YouTube Music) de forma unificada y sin fricción de autenticación para el usuario final.

## Requirements

### Requirement: Detección y validación de URL de playlist
El sistema SHALL validar la URL ingresada por el usuario e identificar automáticamente si pertenece a una playlist pública de Spotify o YouTube Music.

#### Scenario: URL de Spotify válida
- **WHEN** el usuario ingresa un enlace como `https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M`
- **THEN** el sistema identifica la plataforma como Spotify, extrae el ID de la playlist y valida que la URL sea procesable.

#### Scenario: URL de YouTube Music válida
- **WHEN** el usuario ingresa un enlace como `https://music.youtube.com/playlist?list=RDCLAK5uy_k...` o `https://www.youtube.com/playlist?list=PL...`
- **THEN** el sistema identifica la plataforma como YouTube Music y extrae el identificador de la playlist.

#### Scenario: URL no soportada o malformada
- **WHEN** el usuario ingresa una URL inválida o de una plataforma no soportada
- **THEN** el sistema retorna un error descriptivo indicando que el enlace no es válido o no corresponde a una playlist soportada.

### Requirement: Extracción de pistas de Spotify
El sistema SHALL extraer la lista completa de pistas de una playlist de Spotify, obteniendo título, artistas principales, artistas colaboradores y miniatura de portada.

#### Scenario: Extracción con credenciales de Spotify
- **WHEN** existen credenciales `SPOTIFY_CLIENT_ID` y `SPOTIFY_CLIENT_SECRET` configuradas
- **THEN** el sistema solicita un token de aplicación (Client Credentials) y descarga la información paginada de todas las canciones de la playlist.

#### Scenario: Fallback sin credenciales
- **WHEN** no hay credenciales configuradas en el entorno
- **THEN** el sistema intenta obtener los datos públicos mediante token anónimo o scraping de la página pública de Spotify sin fallar inmediatamente.

### Requirement: Extracción de pistas de YouTube Music con paginación
El sistema SHALL extraer las canciones de una playlist pública de YouTube Music utilizando el protocolo HTTP con continuation tokens sin requerir API key de Google.

#### Scenario: Extracción de playlist con más de 100 canciones
- **WHEN** el usuario solicita el análisis de una playlist de YouTube Music con múltiples páginas (hasta más de 1000 pistas)
- **THEN** el sistema itera los continuation tokens de la respuesta InnerTube hasta obtener el listado completo de canciones sin truncar a 100 pistas.

### Requirement: Registro modular y extensible de plataformas
El sistema SHALL mantener un registro modular de plataformas y adaptadores que permita incorporar nuevos servicios de streaming (como Deezer, SoundCloud, Apple Music, Tidal, etc.) desacoplados del motor de extracción y del procesamiento de estadísticas.

#### Scenario: Integración de un nuevo adaptador
- **WHEN** se implementa un nuevo extractor que cumple la interfaz de plataforma
- **THEN** el sistema lo registra como proveedor disponible sin requerir modificaciones en la lógica central de análisis de canciones ni en las demás plataformas.

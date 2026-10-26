# Spec Delta

## MODIFIED Requirements

### Requirement: Detección y validación de URL de playlist
El sistema SHALL validar la URL ingresada por el usuario e identificar automáticamente si pertenece a una playlist pública de Spotify, YouTube Music, Deezer, SoundCloud o Tidal.

#### Scenario: URL de Spotify válida
- **WHEN** el usuario ingresa un enlace como `https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M`
- **THEN** el sistema identifica la plataforma como Spotify, extrae el ID de la playlist y valida que la URL sea procesable.

#### Scenario: URL de YouTube Music válida
- **WHEN** el usuario ingresa un enlace como `https://music.youtube.com/playlist?list=RDCLAK5uy_k...` o `https://www.youtube.com/playlist?list=PL...`
- **THEN** el sistema identifica la plataforma como YouTube Music y extrae el identificador de la playlist.

#### Scenario: URL de Tidal válida
- **WHEN** el usuario ingresa un enlace como `https://tidal.com/browse/playlist/7d3a0166-5f34-4b53-8f0a-4cb4fb1bfb2c` o `https://listen.tidal.com/playlist/7d3a0166-5f34-4b53-8f0a-4cb4fb1bfb2c`
- **THEN** el sistema identifica la plataforma como Tidal, extrae el UUID de la playlist y valida que la URL sea procesable.

#### Scenario: URL no soportada o malformada
- **WHEN** el usuario ingresa una URL inválida o de una plataforma no soportada
- **THEN** el sistema retorna un error descriptivo indicando que el enlace no es válido o no corresponde a una playlist soportada.

## ADDED Requirements

### Requirement: Extracción de pistas de Tidal
El sistema SHALL extraer la lista completa de pistas de una playlist de Tidal pública o compartida, obteniendo título, artistas principales, artistas colaboradores, duración y portada de cada pista.

#### Scenario: Extracción de playlist pública de Tidal
- **WHEN** el usuario ingresa una URL válida de playlist de Tidal
- **THEN** el extractor de Tidal descarga los metadatos de la playlist y la lista estructurada de canciones, normalizando artistas y duraciones para el motor de estadísticas.

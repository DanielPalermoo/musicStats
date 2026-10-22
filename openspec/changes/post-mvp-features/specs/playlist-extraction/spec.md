# Spec Delta: playlist-extraction

## ADDED Requirements

### Requirement: Extracción de pistas de Deezer
El sistema SHALL permitir la extracción de pistas y metadatos de playlists públicas de Deezer a partir de su URL identificando el ID de playlist y consultando la API pública de Deezer.

#### Scenario: URL de Deezer válida
- **WHEN** el usuario ingresa un enlace como `https://www.deezer.com/playlist/3110429622` o `https://deezer.page.link/...`
- **THEN** el sistema extrae el identificador de la playlist, consulta el endpoint público y obtiene la lista de canciones con título, artistas y carátula.

#### Scenario: Playlist privada o inexistente en Deezer
- **WHEN** la playlist de Deezer no existe o no tiene visibilidad pública
- **THEN** el sistema retorna un error descriptivo con código HTTP adecuado indicando que la playlist no está disponible.

### Requirement: Extracción de pistas de SoundCloud
El sistema SHALL permitir la extracción de pistas de sets o playlists públicas de SoundCloud resolviendo la URL de la playlist y obteniendo los metadatos de las canciones.

#### Scenario: URL de SoundCloud válida
- **WHEN** el usuario ingresa un enlace como `https://soundcloud.com/user/sets/playlist-name`
- **THEN** el sistema extrae las canciones que componen el set con títulos, artistas y miniaturas asociadas.

#### Scenario: Playlist privada o inexistente en SoundCloud
- **WHEN** el set de SoundCloud es privado o inválido
- **THEN** el sistema retorna un error descriptivo indicando que la playlist no es accesible.

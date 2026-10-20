# Spec Delta: interactive-ui

## Purpose

Proporciona la interfaz de usuario interactiva y responsiva para consultar playlists, explorar el podio y ver el desglose de canciones por artista.

## ADDED Requirements

### Requirement: Selector de plataforma dinámico y extensible mediante tarjetas (boxes)
El sistema SHALL permitir al usuario seleccionar la plataforma de música mediante tarjetas interactivas ("boxes") a partir de un registro dinámico y extensible de plataformas (incluyendo inicialmente YouTube y Spotify como disponibles, y tarjetas de muestra como Deezer, SoundCloud y futuras plataformas configuradas como "próximamente"), adaptando las instrucciones y validaciones a la plataforma seleccionada.

#### Scenario: Selección de plataforma desde catálogo extensible
- **WHEN** el usuario ingresa a la aplicación
- **THEN** se presentan las tarjetas de las plataformas registradas en el catálogo (mostrando su nombre, icono y estado de disponibilidad); al hacer click en una plataforma activa, queda resaltada para ingresar la playlist.

#### Scenario: Registro de nuevas plataformas a futuro
- **WHEN** se añade una nueva plataforma al catálogo (ej. Apple Music, Tidal, Bandcamp u otras)
- **THEN** el componente renderiza automáticamente su correspondiente tarjeta en la interfaz sin requerir reestructuración del diseño.

#### Scenario: Envío de URL y animación de carga
- **WHEN** el usuario ingresa una URL válida acorde a la plataforma elegida y presiona "Analizar"
- **THEN** el sistema deshabilita el botón, muestra un estado visual de carga ("Extrayendo canciones y analizando estadísticas...") y renderiza los resultados al finalizar.

### Requirement: Podio interactivo del Top 3
El sistema SHALL mostrar un podio visual de los tres artistas más frecuentes con interacciones de hover y click.

#### Scenario: Visualización del podio
- **WHEN** se presentan los resultados
- **THEN** se muestra un podio con el 1° puesto destacado al centro (oro), 2° puesto a la izquierda (plata) y 3° puesto a la derecha (bronce), con nombre, avatar/foto y total de apariciones.

#### Scenario: Hover sobre un artista del podio
- **WHEN** el usuario sitúa el puntero del mouse sobre la tarjeta o avatar de un artista del podio
- **THEN** el sistema despliega una minilista emergente (popover/modal) con un preview de hasta 3 canciones de ese artista en la playlist.

#### Scenario: Click en el perfil del artista
- **WHEN** el usuario hace click en la tarjeta/perfil del artista
- **THEN** el sistema abre un modal interactivo con la imagen del artista, su nombre y la lista completa de todas las canciones donde aparece, indicando portada y colaboradores de cada canción.

### Requirement: Resumen de métricas y previsualización de colaboraciones
El sistema SHALL mostrar un resumen de métricas clave que incluya el total de canciones, la tarjeta del artista #1 y su lista de colaboradores, permitiendo previsualizar los temas en común.

#### Scenario: Hover sobre un colaborador del Artista #1
- **WHEN** el usuario sitúa el cursor sobre uno de los colaboradores listados en la tarjeta del Artista #1
- **THEN** el sistema despliega un popover emergente con los títulos de las canciones en las que dicho colaborador participó junto al artista principal.

### Requirement: Panel de clasificación para los demás artistas
El sistema SHALL presentar un panel complementario con el ranking de los artistas restantes (del 4° puesto en adelante) ubicado en paralelo a la lista de canciones.

#### Scenario: Disposición en paralelo (layout de 2 columnas)
- **WHEN** se despliegan los resultados de la playlist
- **THEN** el sistema presenta en un contenedor de 2 columnas (en pantallas medianas y grandes) la lista de canciones a un lado y el panel de "Demás Artistas" al otro lado, ambos con botones independientes de colapso/despliegue consistentes.

#### Scenario: Interacciones sobre los demás artistas
- **WHEN** el usuario interactúa con un artista del listado del 4° puesto en adelante
- **THEN** al hacer hover se muestra un popover con un preview de canciones del artista, y al hacer click se abre el modal completo de detalles del artista.

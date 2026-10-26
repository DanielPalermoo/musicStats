# Spec Delta

## MODIFIED Requirements

### Requirement: Podio interactivo del Top 3
El sistema SHALL mostrar un podio visual de los tres artistas más frecuentes con interacciones de hover y click, renderizando imágenes reales de artistas/álbumes cuando estén disponibles y manteniendo un fallback visual resiliente a iniciales y gradiente CSS si la imagen falla o no está presente.

#### Scenario: Visualización del podio
- **WHEN** se presentan los resultados
- **THEN** se muestra un podio con el 1° puesto destacado al centro (oro), 2° puesto a la izquierda (plata) y 3° puesto a la derecha (bronce), con nombre, avatar/foto y total de apariciones.

#### Scenario: Hover sobre un artista del podio
- **WHEN** el usuario sitúa el puntero del mouse sobre la tarjeta o avatar de un artista del podio
- **THEN** el sistema despliega una minilista emergente (popover/modal) con un preview de hasta 3 canciones de ese artista en la playlist.

#### Scenario: Click en el perfil del artista
- **WHEN** el usuario hace click en la tarjeta/perfil del artista
- **THEN** el sistema abre un modal interactivo con la imagen del artista, su nombre y la lista completa de todas las canciones donde aparece, indicando portada y colaboradores de cada canción.

#### Scenario: Carga de imagen con error o ausencia de foto
- **WHEN** la URL de la imagen del artista o portada no está disponible o falla al cargar
- **THEN** el sistema muestra automáticamente el avatar con gradiente e iniciales sin romper el diseño de la interfaz.

## ADDED Requirements

### Requirement: Visualización de portadas reales de canciones y artistas
El sistema SHALL propagar las URLs de portadas y miniaturas provistas por los extractores y renderizarlas en los avatares de artistas, tarjetas de canciones, podio y hojas de detalle.

#### Scenario: Canción con portada válida
- **WHEN** una pista posee `coverUrl` o `thumbnailUrl` en los resultados analizados
- **THEN** la interfaz renderiza la imagen real de portada en la lista de canciones y en el detalle del artista con recorte `object-cover`.

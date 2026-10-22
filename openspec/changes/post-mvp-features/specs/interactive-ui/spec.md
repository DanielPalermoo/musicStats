# Spec Delta: interactive-ui

## ADDED Requirements

### Requirement: Generación y descarga de tarjeta visual para compartir
El sistema SHALL permitir al usuario previsualizar y descargar una tarjeta gráfica (estilo resumen / Instagram Story) en formato PNG o SVG con las métricas más destacadas de la playlist (total de canciones, podio Top 3 y artista #1).

#### Scenario: Visualización y descarga en PNG
- **WHEN** los resultados de la playlist están en pantalla y el usuario hace click en "Descargar resumen"
- **THEN** el sistema genera una imagen de alta resolución a partir del componente visual `ExportCard` y dispara la descarga en el navegador con nombre representativo.

### Requirement: Enlaces directos compartibles con estado en URL
El sistema SHALL permitir compartir los resultados de un análisis mediante una URL con parámetros codificados o comprimidos, permitiendo a cualquier receptor ver los resultados sin necesidad de ejecutar nuevamente la extracción.

#### Scenario: Generación de enlace compartible
- **WHEN** el usuario hace click en el botón "Copiar enlace para compartir"
- **THEN** el sistema codifica el resumen estadístico o el identificador de análisis en la URL, lo copia al portapapeles y muestra una confirmación visual.

#### Scenario: Carga directa desde URL compartida
- **WHEN** un usuario abre la aplicación accediendo a una URL que contiene el parámetro de datos codificados
- **THEN** la aplicación decodifica el estado e hidrata inmediatamente las tarjetas de estadísticas, podio y desglose sin solicitar confirmación ni extracción adicional.

### Requirement: Grafo interactivo de red de colaboraciones
El sistema SHALL renderizar un gráfico visual interactivo que represente a los artistas como nodos y a las colaboraciones entre ellos como aristas conectadas.

#### Scenario: Representación visual de colaboraciones
- **WHEN** la playlist analizada contiene artistas con colaboraciones mutuas
- **THEN** se renderiza un grafo donde el tamaño o jerarquía de los nodos corresponde a su presencia, y el grosor de las líneas representa el número de canciones compartidas.

#### Scenario: Interacción sobre nodos del grafo
- **WHEN** el usuario hace hover o click sobre un nodo del artista en el grafo
- **THEN** se resaltan sus conexiones directas y se ofrece acceso al detalle de canciones compartidas con sus colaboradores.

### Requirement: Activación de Deezer y SoundCloud en el catálogo de plataformas
El sistema SHALL habilitar Deezer y SoundCloud en el componente de selección de plataformas, permitiendo seleccionarlas como activas.

#### Scenario: Selección activa de Deezer y SoundCloud
- **WHEN** el usuario navega por las tarjetas de plataforma disponibles
- **THEN** las tarjetas de Deezer y SoundCloud se muestran activas y seleccionables con sus logotipos y placeholders de URL correspondientes.

# music-stats-analysis Specification

## Purpose
Calcula las métricas de distribución de artistas, colaboraciones y podio a partir de las pistas extraídas de una playlist.

## Requirements

### Requirement: Normalización y extracción de artistas y colaboraciones
El sistema SHALL analizar cada pista para extraer el artista principal y todos los artistas colaboradores, reconociendo metadatos estructurados y patrones en el título (`feat.`, `ft.`, `with`, `&`, `x`).

#### Scenario: Pista con múltiples artistas estructurados
- **WHEN** la pista incluye una lista de artistas `[Artista A, Artista B]` en sus metadatos
- **THEN** el sistema registra a Artista A y Artista B como presentes en la canción y anota su colaboración recíproca en dicha canción.

#### Scenario: Pista con colaboradores incluidos en el título
- **WHEN** el título de la pista tiene el formato "Canción (feat. Artista C)" o "Artista A x Artista B"
- **THEN** el sistema extrae a los colaboradores del título y los añade a las apariciones y colaboraciones de esa pista.

### Requirement: Cálculo de estadísticas generales y artista más frecuente
El sistema SHALL computar el total de canciones de la playlist y determinar el artista con mayor número de apariciones, desglosando sus canciones y sus colaboradores.

#### Scenario: Determinación del artista más repetido
- **WHEN** finaliza el procesamiento de las pistas de la playlist
- **THEN** el sistema identifica al artista con mayor cantidad de apariciones, la lista de títulos donde participa y el mapa de artistas con los que colaboró y en cuáles canciones.

### Requirement: Generación del Podio Top 3 de artistas
El sistema SHALL ordenar a los artistas por cantidad de apariciones de mayor a menor y seleccionar el Top 3 para el podio visual.

#### Scenario: Ordenamiento del podio
- **WHEN** existen múltiples artistas en la playlist
- **THEN** el primer puesto corresponde al artista con más apariciones, el segundo puesto al siguiente y el tercer puesto al tercero; incluyendo sus fotos y conteo de canciones.

#### Scenario: Empates en cantidad de apariciones
- **WHEN** dos o más artistas tienen la misma cantidad de apariciones
- **THEN** el sistema resuelve el orden por orden de primera aparición en la playlist o por cantidad de colaboraciones principales de forma consistente.

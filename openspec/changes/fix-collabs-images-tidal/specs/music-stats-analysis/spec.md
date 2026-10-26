# Spec Delta

## MODIFIED Requirements

### Requirement: Normalización y extracción de artistas y colaboraciones
El sistema SHALL analizar cada pista para extraer el artista principal y todos los artistas colaboradores, reconociendo metadatos estructurados y patrones en el título (`feat.`, `ft.`, `with`, `&`, `x`). En títulos planos sin delimitadores de paréntesis o corchetes, las conjunciones o letras individuales como "y" o "x" NO SHALL considerarse indicadores de colaboración que fragmenten el título de la canción.

#### Scenario: Pista con múltiples artistas estructurados
- **WHEN** la pista incluye una lista de artistas `[Artista A, Artista B]` en sus metadatos
- **THEN** el sistema registra a Artista A y Artista B como presentes en la canción y anota su colaboración recíproca en dicha canción.

#### Scenario: Pista con colaboradores incluidos en el título
- **WHEN** el título de la pista tiene el formato "Canción (feat. Artista C)" o "Artista A x Artista B"
- **THEN** el sistema extrae a los colaboradores del título y los añade a las apariciones y colaboraciones de esa pista.

#### Scenario: Título de canción con conjunción "y" o "x" en texto plano
- **WHEN** el título de la pista contiene palabras o conjunciones como "y" (por ejemplo "Toco Y Me Voy", "Amor y Control") sin marcadores explícitos de feat
- **THEN** el sistema conserva el título íntegro de la canción y no extrae artistas fantasma ni marca la canción como colaboración errónea.

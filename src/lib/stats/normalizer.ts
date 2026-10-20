/**
 * Normalizador de artistas y títulos.
 *
 * Responsabilidades:
 * - Canonicalizar nombres de artistas (espacios, mayúsculas, diacríticos, sufijos
 *   como "- Topic" o "VEVO") para agrupar variantes de un mismo artista.
 * - Extraer colaboradores adicionales desde strings de artistas y desde títulos
 *   de canciones mediante expresiones regulares (feat., ft., with, &, x, etc.).
 */

import type { ExtractedTrack } from '@/types/playlist';

/** Nombre usado cuando la extracción no pudo identificar al artista. */
export const UNKNOWN_ARTIST = 'Artista Desconocido';

/**
 * Palabras clave que introducen colaboradores. El orden importa: los literales
 * más largos van primero para que "featuring" no lo gane "feat".
 * Incluye también el "y" español (equivalente a "with"/"&").
 */
const COLLAB_KEYWORDS_SOURCE = String.raw`\b(?:featuring|feat|ft|with|vs|x|y)\b\.?`;

/** Regex sin bandera global para test/search (las globales con .test() son estado-dependientes). */
const COLLAB_KEYWORD_TEST_REGEX = new RegExp(COLLAB_KEYWORDS_SOURCE, 'i');

/** Regex global para reemplazar todas las keywords por un separador canónico. */
const COLLAB_KEYWORDS_GLOBAL_REGEX = new RegExp(COLLAB_KEYWORDS_SOURCE, 'gi');

/** Corchetes/quotes/guiones basura que pueden flotar alrededor de un nombre. */
const LEADING_JUNK_REGEX = /^[-\s"'“”‘’«»(\[{·•*\u2013\u2014]+/;
const TRAILING_JUNK_REGEX = /[-\s"'“”‘’«»)\]}·•*\u2013\u2014]+$/;

/** Segmentos que suelen aparecer en títulos pero nunca son artistas. */
const NOISE_SEGMENTS = new Set([
  'official video',
  'official audio',
  'official music video',
  'music video',
  'lyric video',
  'lyrics video',
  'official',
  'video',
  'audio',
  'lyrics',
  'remix',
  'edit',
  'extended',
  'version',
  'visualizer',
  'cover',
  'live',
  'instrumental',
  'acoustic',
  'single',
  'album',
  'deluxe',
  'performance',
]);

/** Nombre normalizado: clave canónica para agrupar + nombre para mostrar. */
export interface NormalizedName {
  /** Clave canónica (minúsculas, sin diacríticos, espacios colapsados). */
  key: string;
  /** Nombre con la capitalización y puntuación original, solo limpio de espacios/puntuación periférica. */
  displayName: string;
}

/**
 * Limpia un segmento de nombre: quita puntuación basura de los extremos y
 * colapsa espacios múltiples.
 */
function cleanArtistSegment(segment: string): string {
  return segment
    .replace(LEADING_JUNK_REGEX, '')
    .replace(TRAILING_JUNK_REGEX, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isMeaningfulArtistSegment(segment: string): boolean {
  if (!segment) return false;
  return !NOISE_SEGMENTS.has(segment.toLowerCase());
}

/**
 * Reemplaza las palabras clave de colaboración por comas, salvo las letras
 * sueltas "x"/"y" en los extremos del string, que casi siempre son parte del
 * nombre del artista (ej. "Artist X") y no un separador.
 */
function replaceKeywordsWithSeparators(text: string): string {
  return text.replace(
    COLLAB_KEYWORDS_GLOBAL_REGEX,
    (match: string, offset: number, whole: string) => {
      const bare = match.replace(/\.$/, '').toLowerCase();
      if (bare === 'x' || bare === 'y') {
        const before = whole.slice(0, offset);
        const after = whole.slice(offset + match.length);
        if (!/\S/.test(before) || !/\S/.test(after)) {
          return match; // "X"/"y" al inicio o final: no es separador.
        }
      }
      return ',';
    }
  );
}

/**
 * Divide un string de artistas en sus partes, usando como separadores comas,
 * "&" y palabras clave de colaboración (feat., ft., featuring, with, vs, x, y).
 *
 * Ejemplos:
 *   "Bad Bunny, Jhay Cortez & Farru"  -> ["Bad Bunny", "Jhay Cortez", "Farru"]
 *   "Bad Bunny feat. Jhay Cortez"     -> ["Bad Bunny", "Jhay Cortez"]
 *   "KAROL G x TIAGO PZK"             -> ["KAROL G", "TIAGO PZK"]
 */
export function extractCollaborators(artistString: string): string[] {
  return replaceKeywordsWithSeparators(artistString)
    .replace(/&/g, ',')
    .split(',')
    .map(cleanArtistSegment)
    .filter(isMeaningfulArtistSegment);
}

/**
 * Extrae los colaboradores embebidos en el TÍTULO de una canción.
 * Soporta formatos comunes:
 *   "Canción (feat. Artista B)"          -> ["Artista B"]
 *   "Canción ft. Artista B & Artista C"  -> ["Artista B", "Artista C"]
 *   "Artista A x Artista B - Canción"    -> ["Artista B"]
 */
export function extractCollaboratorsFromTitle(title: string): string[] {
  const collaborators: string[] = [];

  // 1) Paréntesis que contengan una keyword de colaboración: "Canción (feat. A, B)"
  const parenRegex = /\(([^()]*)\)/g;
  const parenSegments: string[] = [];
  let remainder = title;
  let match: RegExpExecArray | null;
  while ((match = parenRegex.exec(title)) !== null) {
    const inner = match[1];
    if (COLLAB_KEYWORD_TEST_REGEX.test(inner)) {
      parenSegments.push(inner);
    }
  }
  // Quitamos del texto principal los paréntesis que eran colaboración.
  remainder = remainder.replace(/\(([^()]*)\)/g, (full, inner: string) =>
    COLLAB_KEYWORD_TEST_REGEX.test(inner) ? ' ' : full
  );

  // 2) Texto fuera de paréntesis: los colaboradores van después de la primera keyword.
  // Quitamos TODOS los paréntesis del resto (los de colaboración ya se procesaron arriba)
  // para que ruido como "(Official Video)" no se pegue a los nombres.
  remainder = remainder.replace(/\([^()]*\)/g, ' ');
  const keywordIndex = remainder.search(COLLAB_KEYWORD_TEST_REGEX);
  if (keywordIndex >= 0) {
    const afterKeyword = remainder
      .slice(keywordIndex)
      .replace(COLLAB_KEYWORD_TEST_REGEX, ' ');
    // Cortamos en el primer guion separador: "feat. A B - Official Video" -> "A B"
    const region = afterKeyword.split(/\s+[-\u2013\u2014]\s+/)[0];
    collaborators.push(...extractCollaborators(region));
  }

  // 3) Colaboradores dentro de paréntesis.
  for (const segment of parenSegments) {
    collaborators.push(...extractCollaborators(segment));
  }

  return dedupeNames(collaborators);
}

/**
 * Normaliza un nombre de artista: limpia sufijos de canales automáticos
 * ("- Topic", "VEVO"), espacios y puntuación periférica, y produce una clave
 * canónica sin diacríticos ni variaciones de mayúsculas.
 */
export function normalizeArtistName(raw: string): NormalizedName | null {
  const cleaned = cleanArtistSegment(
    raw
      .trim()
      .replace(/\s*-\s*Topic$/i, '')
      .replace(/\s*VEVO$/i, '')
  );
  if (!cleaned) return null;

  const key = cleaned
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  if (!key) return null;

  return { key, displayName: cleaned };
}

const UNKNOWN_ARTIST_KEY =
  normalizeArtistName(UNKNOWN_ARTIST)?.key ?? 'artista desconocido';

/**
 * Devuelve la lista completa de artistas (normalizados) de una pista:
 * une los artistas estructurados del extractor (`allArtists`/`mainArtist`,
 * ya subdivididos por keywords) con los colaboradores extraídos del título.
 * Filtra el artista desconocido y duplicados por clave canónica.
 */
export function getTrackArtists(track: ExtractedTrack): NormalizedName[] {
  const candidates: string[] = [];

  for (const artist of track.allArtists) {
    candidates.push(...extractCollaborators(artist));
  }
  if (track.mainArtist) {
    candidates.push(...extractCollaborators(track.mainArtist));
  }
  candidates.push(...extractCollaboratorsFromTitle(track.title));

  const seen = new Set<string>();
  const result: NormalizedName[] = [];
  for (const candidate of candidates) {
    const normalized = normalizeArtistName(candidate);
    if (!normalized) continue;
    if (normalized.key === UNKNOWN_ARTIST_KEY) continue;
    if (seen.has(normalized.key)) continue;
    seen.add(normalized.key);
    result.push(normalized);
  }
  return result;
}

function dedupeNames(names: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const name of names) {
    const normalized = normalizeArtistName(name);
    if (!normalized) continue;
    if (normalized.key === UNKNOWN_ARTIST_KEY) continue;
    if (seen.has(normalized.key)) continue;
    seen.add(normalized.key);
    result.push(normalized.displayName);
  }
  return result;
}

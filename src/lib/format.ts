/**
 * Utilidades de formato compartidas por los componentes de la interfaz.
 */

/** Devuelve hasta dos iniciales para usar como avatar de respaldo. */
export function getInitials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);

  if (words.length === 0) return '?';

  const initials = words
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase();

  return initials || '?';
}

/** Convierte un número en singular/plural de canciones. */
export function songsLabel(count: number): string {
  return count === 1 ? '1 canción' : `${count} canciones`;
}

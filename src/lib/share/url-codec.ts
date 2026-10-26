/**
 * Códec de enlaces compartibles.
 *
 * Serializa un resumen estadístico de una playlist en un string Base64URL
 * seguro para la barra de direcciones (`?share=...`). El formato de
 * transporte usa claves cortas y descarta datos prescindibles (como la
 * portada de cada canción) para mantener las URLs razonablemente pequeñas.
 *
 * La decodificación es defensiva: valida versión, tipos, rangos numéricos,
 * longitudes de texto y URLs antes de reconstruir las estadísticas. Cualquier
 * string truncado, corrupto o manipulado se reporta con un `ShareCodecError`
 * tipado en lugar de lanzar una excepción al renderizar la página.
 */

import type { PlatformType } from '@/types/playlist';
import type {
  ArtistStats,
  CollaborationInfo,
  PlaylistStats,
  PodiumEntry,
  TrackAppearance,
} from '@/types/stats';

/** Nombre del query param que transporta el payload. */
export const SHARE_QUERY_PARAM = 'share';

/** Versión del formato de transporte. Permite evolucionar el códec. */
export const SHARE_PAYLOAD_VERSION = 1;

/**
 * Longitud máxima del string Base64URL aceptado en una URL. Los navegadores
 * modernos soportan URLs mucho más largas, pero mantener el límite evita
 * enlaces que se rompan al compartirlos por chats o redes sociales.
 */
export const MAX_SHARE_PAYLOAD_LENGTH = 16_384;

/** Límites de validación compartidos por la codificación y la decodificación. */
export const SHARE_LIMITS = {
  totalTracks: 100_000,
  totalArtists: 100_000,
  artists: 50,
  tracksPerArtist: 25,
  collaborationsPerArtist: 20,
  collaboratorsPerTrack: 20,
  sharedTracksPerCollaboration: 10,
  playlistId: 128,
  playlistTitle: 200,
  artistKey: 120,
  artistName: 120,
  trackId: 200,
  trackTitle: 300,
  thumbnailUrl: 2_048,
} as const;

/** Resumen mínimo necesario para reconstruir la vista de resultados. */
export interface SharePayload {
  platform: PlatformType;
  playlistId: string;
  playlistTitle: string;
  stats: PlaylistStats;
}

export type ShareCodecErrorCode =
  | 'empty'
  | 'invalid_encoding'
  | 'invalid_json'
  | 'invalid_structure'
  | 'unsupported_version'
  | 'payload_too_large';

/** Error tipado producido por `encodeSharePayload` / `decodeSharePayload`. */
export class ShareCodecError extends Error {
  readonly code: ShareCodecErrorCode;

  constructor(code: ShareCodecErrorCode, message: string) {
    super(message);
    this.name = 'ShareCodecError';
    this.code = code;
  }
}

export type DecodeShareResult =
  | { ok: true; payload: SharePayload }
  | { ok: false; error: ShareCodecError };

/* ------------------------------------------------------------------ */
/* Formato de transporte (claves cortas)                              */
/* ------------------------------------------------------------------ */

type WireTrack = [trackId: string, title: string, isMain: 0 | 1, collaborators: string[]];

type WireCollaboration = [artist: string, sharedTrackCount: number, sharedTracks: string[]];

interface WireArtist {
  k: string;
  n: string;
  c: number;
  m: number;
  f: number;
  tr: WireTrack[];
  co: WireCollaboration[];
}

interface WirePayload {
  v: number;
  p: string;
  i: string;
  t: string;
  tt: number;
  ta: number;
  a: WireArtist[];
  th?: string[];
}

interface DetailLevel {
  artists: number;
  tracks: number;
  collaborations: number;
  sharedTracks: number;
}

/**
 * Niveles de detalle usados por el encoder. Se intenta el más completo y, si
 * el string supera el límite, se degrada la información hasta que quepa.
 */
const DETAIL_LEVELS: DetailLevel[] = [
  {
    artists: SHARE_LIMITS.artists,
    tracks: SHARE_LIMITS.tracksPerArtist,
    collaborations: SHARE_LIMITS.collaborationsPerArtist,
    sharedTracks: SHARE_LIMITS.sharedTracksPerCollaboration,
  },
  { artists: 30, tracks: 8, collaborations: 8, sharedTracks: 5 },
  { artists: 15, tracks: 3, collaborations: 3, sharedTracks: 2 },
  { artists: 10, tracks: 0, collaborations: 0, sharedTracks: 0 },
];

const PLATFORM_CODES: Record<PlatformType, string> = {
  youtube_music: 'y',
  spotify: 's',
  deezer: 'd',
  soundcloud: 'c',
  tidal: 't',
};

const PLATFORM_BY_CODE: Record<string, PlatformType> = {
  y: 'youtube_music',
  s: 'spotify',
  d: 'deezer',
  c: 'soundcloud',
  t: 'tidal',
};

const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;
const PLAYLIST_ID_PATTERN = /^[A-Za-z0-9._~-]+$/;

/* ------------------------------------------------------------------ */
/* API pública                                                        */
/* ------------------------------------------------------------------ */

/**
 * Serializa un resumen estadístico en un string Base64URL.
 *
 * @throws {ShareCodecError} si el payload no tiene la estructura esperada o
 *   no puede reducirse por debajo de `MAX_SHARE_PAYLOAD_LENGTH`.
 */
export function encodeSharePayload(payload: SharePayload): string {
  assertSharePayload(payload);

  let tooLarge: ShareCodecError | null = null;

  for (const level of DETAIL_LEVELS) {
    const wire = buildWire(payload, level);
    const encoded = encodeWire(wire);
    if (encoded.length <= MAX_SHARE_PAYLOAD_LENGTH) {
      return encoded;
    }
    tooLarge = new ShareCodecError(
      'payload_too_large',
      `El enlace compartido supera el límite de ${MAX_SHARE_PAYLOAD_LENGTH} caracteres.`
    );
  }

  throw tooLarge ?? new ShareCodecError('payload_too_large', 'No se pudo generar un enlace válido.');
}

/**
 * Decodifica y valida un payload compartido. Nunca lanza por datos corruptos:
 * devuelve `{ ok: false, error }` para que la UI pueda mostrar un aviso.
 */
export function decodeSharePayload(raw: string | null | undefined): DecodeShareResult {
  try {
    if (typeof raw !== 'string') {
      return failure('empty', 'No se recibió ningún enlace compartido.');
    }

    const encoded = raw.trim();
    if (!encoded) {
      return failure('empty', 'El enlace compartido está vacío.');
    }

    if (encoded.length > MAX_SHARE_PAYLOAD_LENGTH) {
      return failure(
        'payload_too_large',
        `El enlace compartido supera el límite de ${MAX_SHARE_PAYLOAD_LENGTH} caracteres.`
      );
    }

    const json = decodeBase64Url(encoded);

    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      return failure('invalid_json', 'El enlace compartido no contiene un JSON válido.');
    }

    return { ok: true, payload: fromWire(validateWire(parsed)) };
  } catch (error) {
    if (error instanceof ShareCodecError) {
      return { ok: false, error };
    }
    return failure('invalid_structure', 'El enlace compartido tiene un formato inesperado.');
  }
}

/**
 * Construye una URL absoluta con el payload codificado en `?share=...`.
 * Conserva el resto de parámetros y el hash de la URL base.
 */
export function buildShareUrl(baseUrl: string, payload: SharePayload): string {
  const encoded = encodeSharePayload(payload);
  const url = new URL(baseUrl);
  url.searchParams.set(SHARE_QUERY_PARAM, encoded);
  return url.toString();
}

/* ------------------------------------------------------------------ */
/* Codificación                                                       */
/* ------------------------------------------------------------------ */

function assertSharePayload(payload: unknown): asserts payload is SharePayload {
  if (!isRecord(payload)) {
    throw invalidStructure('El payload no es un objeto.');
  }

  if (!isPlatformType(payload.platform)) {
    throw invalidStructure('La plataforma no está soportada.');
  }

  if (typeof payload.playlistId !== 'string') {
    throw invalidStructure('playlistId no es texto.');
  }
  const playlistId = payload.playlistId.trim();
  if (!playlistId || !PLAYLIST_ID_PATTERN.test(playlistId)) {
    throw invalidStructure('playlistId contiene caracteres no permitidos.');
  }

  if (typeof payload.playlistTitle !== 'string') {
    throw invalidStructure('playlistTitle no es texto.');
  }

  if (!isRecord(payload.stats)) {
    throw invalidStructure('stats no es un objeto.');
  }

  const stats = payload.stats;
  const totalTracks = readInteger(
    stats.totalTracks,
    0,
    SHARE_LIMITS.totalTracks,
    'stats.totalTracks'
  );
  const totalArtists = readInteger(
    stats.totalArtists,
    0,
    SHARE_LIMITS.totalArtists,
    'stats.totalArtists'
  );

  if (!Array.isArray(stats.artists)) {
    throw invalidStructure('stats.artists no es un arreglo.');
  }

  const requiredArtists = Math.min(stats.artists.length, SHARE_LIMITS.artists);
  if (totalArtists < requiredArtists) {
    throw invalidStructure('stats.totalArtists es menor que la cantidad de artistas.');
  }

  // Sanity check: las apariciones no pueden superar las pistas totales.
  if (stats.artists.length > 0 && totalTracks === 0) {
    throw invalidStructure('stats.totalTracks es 0 pero hay artistas.');
  }
}

function buildWire(payload: SharePayload, level: DetailLevel): WirePayload {
  const artists = collectArtists(payload.stats)
    .slice(0, level.artists)
    .map((artist, index) => toWireArtist(artist, level, index))
    .filter((artist): artist is WireArtist => artist !== null);

  const thumbnails = collectThumbnails(payload.stats.podium);

  return {
    v: SHARE_PAYLOAD_VERSION,
    p: PLATFORM_CODES[payload.platform],
    i: sanitizeText(payload.playlistId, SHARE_LIMITS.playlistId),
    t:
      sanitizeText(payload.playlistTitle, SHARE_LIMITS.playlistTitle) ||
      'Playlist compartida',
    tt: payload.stats.totalTracks,
    ta: Math.max(payload.stats.totalArtists, artists.length),
    a: artists,
    ...(thumbnails.some(Boolean) ? { th: thumbnails } : {}),
  };
}

function toWireArtist(
  artist: ArtistStats,
  level: DetailLevel,
  index: number
): WireArtist | null {
  const key = sanitizeText(artist?.key, SHARE_LIMITS.artistKey);
  const name = sanitizeText(artist?.name, SHARE_LIMITS.artistName);
  if (!key || !name) return null;

  const appearanceCount = clampInteger(
    artist.appearanceCount,
    0,
    SHARE_LIMITS.totalTracks
  );
  const mainTrackCount = clampInteger(artist.mainTrackCount, 0, appearanceCount);
  // La invariante del calculador es appearance = main + featured.
  const featuredTrackCount = appearanceCount - mainTrackCount;

  const tracks = Array.isArray(artist.tracks)
    ? artist.tracks
        .slice(0, Math.min(level.tracks, appearanceCount))
        .map((track, trackIndex) => toWireTrack(track, trackIndex))
        .filter((track): track is WireTrack => track !== null)
    : [];

  const collaborations = Array.isArray(artist.collaborations)
    ? artist.collaborations
        .slice(0, level.collaborations)
        .map((collaboration) => toWireCollaboration(collaboration, level))
        .filter((collaboration): collaboration is WireCollaboration => collaboration !== null)
    : [];

  return {
    k: key || `artist-${index}`,
    n: name,
    c: appearanceCount,
    m: mainTrackCount,
    f: featuredTrackCount,
    tr: tracks,
    co: collaborations,
  };
}

function toWireTrack(track: TrackAppearance | undefined, index: number): WireTrack | null {
  if (!track || typeof track !== 'object') return null;

  const trackId =
    sanitizeText(track.trackId, SHARE_LIMITS.trackId) || `track-${index}`;
  const title = sanitizeText(track.trackTitle, SHARE_LIMITS.trackTitle);
  const collaborators = Array.isArray(track.collaborators)
    ? track.collaborators
        .slice(0, SHARE_LIMITS.collaboratorsPerTrack)
        .map((collaborator) => sanitizeText(collaborator, SHARE_LIMITS.artistName))
        .filter((collaborator) => collaborator.length > 0)
    : [];

  return [trackId, title, track.isMainArtist ? 1 : 0, collaborators];
}

function toWireCollaboration(
  collaboration: CollaborationInfo | undefined,
  level: DetailLevel
): WireCollaboration | null {
  if (!collaboration || typeof collaboration !== 'object') return null;

  const artist = sanitizeText(collaboration.artist, SHARE_LIMITS.artistName);
  if (!artist) return null;

  const sharedTrackCount = clampInteger(
    collaboration.sharedTrackCount,
    1,
    SHARE_LIMITS.totalTracks
  );

  const sharedTracks = Array.isArray(collaboration.sharedTracks)
    ? collaboration.sharedTracks
        .slice(0, Math.min(level.sharedTracks, sharedTrackCount))
        .map((track) => sanitizeText(track, SHARE_LIMITS.trackTitle))
    : [];

  return [artist, sharedTrackCount, sharedTracks];
}

function collectArtists(stats: PlaylistStats): ArtistStats[] {
  const seen = new Set<string>();
  const artists: ArtistStats[] = [];

  const push = (candidate: unknown) => {
    if (!isRecord(candidate)) return;
    const key = typeof candidate.key === 'string' ? candidate.key.trim() : '';
    if (!key || seen.has(key)) return;
    seen.add(key);
    artists.push(candidate as unknown as ArtistStats);
  };

  if (Array.isArray(stats.artists)) {
    for (const artist of stats.artists) push(artist);
  }
  if (Array.isArray(stats.podium)) {
    for (const entry of stats.podium) push(entry?.artist);
  }
  push(stats.topArtist);

  return artists;
}

function collectThumbnails(podium: PodiumEntry[] | undefined): string[] {
  const thumbnails: string[] = [];

  for (let rank = 1; rank <= 3; rank += 1) {
    const entry = Array.isArray(podium)
      ? podium.find((candidate) => candidate?.rank === rank)
      : undefined;
    thumbnails.push(sanitizeThumbnail(entry?.thumbnailUrl) ?? '');
  }

  while (thumbnails.length > 0 && thumbnails[thumbnails.length - 1] === '') {
    thumbnails.pop();
  }

  return thumbnails;
}

/* ------------------------------------------------------------------ */
/* Decodificación y validación                                        */
/* ------------------------------------------------------------------ */

function validateWire(value: unknown): WirePayload {
  if (!isRecord(value)) {
    throw invalidStructure('El contenido no es un objeto.');
  }

  if (typeof value.v !== 'number' || !Number.isInteger(value.v)) {
    throw invalidStructure('La versión del payload no es válida.');
  }
  if (value.v !== SHARE_PAYLOAD_VERSION) {
    throw new ShareCodecError(
      'unsupported_version',
      `La versión ${value.v} del enlace compartido no está soportada.`
    );
  }

  if (
    typeof value.p !== 'string' ||
    !Object.prototype.hasOwnProperty.call(PLATFORM_BY_CODE, value.p)
  ) {
    throw invalidStructure('La plataforma del payload no es válida.');
  }

  const playlistId = readText(value.i, SHARE_LIMITS.playlistId, 'playlistId');
  if (!PLAYLIST_ID_PATTERN.test(playlistId)) {
    throw invalidStructure('playlistId contiene caracteres no permitidos.');
  }

  const playlistTitle = readText(value.t, SHARE_LIMITS.playlistTitle, 'playlistTitle');
  const totalTracks = readInteger(
    value.tt,
    0,
    SHARE_LIMITS.totalTracks,
    'totalTracks'
  );
  const totalArtists = readInteger(
    value.ta,
    0,
    SHARE_LIMITS.totalArtists,
    'totalArtists'
  );

  if (!Array.isArray(value.a)) {
    throw invalidStructure('La lista de artistas no es un arreglo.');
  }
  if (value.a.length > SHARE_LIMITS.artists) {
    throw invalidStructure('El payload contiene demasiados artistas.');
  }
  if (totalArtists < value.a.length) {
    throw invalidStructure('totalArtists es inconsistente con la lista de artistas.');
  }

  const rawArtists = value.a as unknown[];
  const seenKeys = new Set<string>();
  const artists = rawArtists.map((artist, index) =>
    validateWireArtist(artist, index, totalTracks, seenKeys)
  );

  let thumbnails: string[] | undefined;
  if (value.th !== undefined) {
    if (!Array.isArray(value.th) || value.th.length > 3) {
      throw invalidStructure('La lista de miniaturas no es válida.');
    }
    thumbnails = value.th.map((thumbnail, index) => {
      if (thumbnail === '') return '';
      if (typeof thumbnail !== 'string') {
        throw invalidStructure(`thumbnail[${index}] no es texto.`);
      }
      return readThumbnailUrl(thumbnail, index);
    });
  }

  return {
    v: SHARE_PAYLOAD_VERSION,
    p: value.p,
    i: playlistId,
    t: playlistTitle,
    tt: totalTracks,
    ta: totalArtists,
    a: artists,
    ...(thumbnails ? { th: thumbnails } : {}),
  };
}

function validateWireArtist(
  value: unknown,
  index: number,
  totalTracks: number,
  seenKeys: Set<string>
): WireArtist {
  if (!isRecord(value)) {
    throw invalidStructure(`artist[${index}] no es un objeto.`);
  }

  const key = readText(value.k, SHARE_LIMITS.artistKey, `artist[${index}].key`);
  if (seenKeys.has(key)) {
    throw invalidStructure(`artist[${index}].key está duplicada.`);
  }
  seenKeys.add(key);

  const name = readText(value.n, SHARE_LIMITS.artistName, `artist[${index}].name`);
  const appearanceCount = readInteger(
    value.c,
    0,
    totalTracks,
    `artist[${index}].appearanceCount`
  );
  const mainTrackCount = readInteger(
    value.m,
    0,
    appearanceCount,
    `artist[${index}].mainTrackCount`
  );
  const featuredTrackCount = readInteger(
    value.f,
    0,
    appearanceCount,
    `artist[${index}].featuredTrackCount`
  );

  if (mainTrackCount + featuredTrackCount !== appearanceCount) {
    throw invalidStructure(`artist[${index}] tiene conteos inconsistentes.`);
  }

  if (!Array.isArray(value.tr)) {
    throw invalidStructure(`artist[${index}].tracks no es un arreglo.`);
  }
  if (value.tr.length > SHARE_LIMITS.tracksPerArtist) {
    throw invalidStructure(`artist[${index}] contiene demasiadas canciones.`);
  }
  if (value.tr.length > appearanceCount) {
    throw invalidStructure(`artist[${index}] tiene más canciones que apariciones.`);
  }

  const rawTracks = value.tr as unknown[];
  const tracks = rawTracks.map((track, trackIndex) =>
    validateWireTrack(track, index, trackIndex)
  );

  if (!Array.isArray(value.co)) {
    throw invalidStructure(`artist[${index}].collaborations no es un arreglo.`);
  }
  if (value.co.length > SHARE_LIMITS.collaborationsPerArtist) {
    throw invalidStructure(`artist[${index}] contiene demasiadas colaboraciones.`);
  }

  const rawCollaborations = value.co as unknown[];
  const collaborations = rawCollaborations.map((collaboration, collabIndex) =>
    validateWireCollaboration(collaboration, index, collabIndex, totalTracks)
  );

  return {
    k: key,
    n: name,
    c: appearanceCount,
    m: mainTrackCount,
    f: featuredTrackCount,
    tr: tracks,
    co: collaborations,
  };
}

function validateWireTrack(
  value: unknown,
  artistIndex: number,
  trackIndex: number
): WireTrack {
  if (!Array.isArray(value) || value.length !== 4) {
    throw invalidStructure(`artist[${artistIndex}].tracks[${trackIndex}] es inválida.`);
  }

  const trackId = readText(
    value[0],
    SHARE_LIMITS.trackId,
    `artist[${artistIndex}].tracks[${trackIndex}].trackId`
  );
  const title = readText(
    value[1],
    SHARE_LIMITS.trackTitle,
    `artist[${artistIndex}].tracks[${trackIndex}].title`,
    true
  );

  const isMain = value[2];
  if (isMain !== 0 && isMain !== 1) {
    throw invalidStructure(
      `artist[${artistIndex}].tracks[${trackIndex}].isMainArtist es inválido.`
    );
  }

  if (!Array.isArray(value[3])) {
    throw invalidStructure(
      `artist[${artistIndex}].tracks[${trackIndex}].collaborators no es un arreglo.`
    );
  }
  if (value[3].length > SHARE_LIMITS.collaboratorsPerTrack) {
    throw invalidStructure(
      `artist[${artistIndex}].tracks[${trackIndex}] tiene demasiados colaboradores.`
    );
  }

  const collaborators = (value[3] as unknown[]).map((collaborator, collaboratorIndex) =>
    readText(
      collaborator,
      SHARE_LIMITS.artistName,
      `artist[${artistIndex}].tracks[${trackIndex}].collaborators[${collaboratorIndex}]`
    )
  );

  return [trackId, title, isMain, collaborators];
}

function validateWireCollaboration(
  value: unknown,
  artistIndex: number,
  collabIndex: number,
  totalTracks: number
): WireCollaboration {
  if (!Array.isArray(value) || value.length !== 3) {
    throw invalidStructure(
      `artist[${artistIndex}].collaborations[${collabIndex}] es inválida.`
    );
  }

  const artist = readText(
    value[0],
    SHARE_LIMITS.artistName,
    `artist[${artistIndex}].collaborations[${collabIndex}].artist`
  );
  const sharedTrackCount = readInteger(
    value[1],
    1,
    SHARE_LIMITS.totalTracks,
    `artist[${artistIndex}].collaborations[${collabIndex}].sharedTrackCount`
  );

  if (sharedTrackCount > totalTracks) {
    throw invalidStructure(
      `artist[${artistIndex}].collaborations[${collabIndex}] supera las pistas totales.`
    );
  }

  if (!Array.isArray(value[2])) {
    throw invalidStructure(
      `artist[${artistIndex}].collaborations[${collabIndex}].sharedTracks no es un arreglo.`
    );
  }
  if (value[2].length > SHARE_LIMITS.sharedTracksPerCollaboration) {
    throw invalidStructure(
      `artist[${artistIndex}].collaborations[${collabIndex}] tiene demasiadas canciones.`
    );
  }
  if (value[2].length > sharedTrackCount) {
    throw invalidStructure(
      `artist[${artistIndex}].collaborations[${collabIndex}] tiene canciones inconsistentes.`
    );
  }

  const sharedTracks = (value[2] as unknown[]).map((track, trackIndex) =>
    readText(
      track,
      SHARE_LIMITS.trackTitle,
      `artist[${artistIndex}].collaborations[${collabIndex}].sharedTracks[${trackIndex}]`,
      true
    )
  );

  return [artist, sharedTrackCount, sharedTracks];
}

function fromWire(wire: WirePayload): SharePayload {
  const artists: ArtistStats[] = wire.a.map((artist) => ({
    key: artist.k,
    name: artist.n,
    appearanceCount: artist.c,
    mainTrackCount: artist.m,
    featuredTrackCount: artist.f,
    tracks: artist.tr.map(
      ([trackId, trackTitle, isMain, collaborators]): TrackAppearance => ({
        trackId,
        trackTitle,
        isMainArtist: isMain === 1,
        collaborators: [...collaborators],
      })
    ),
    collaborations: artist.co.map(
      ([artistName, sharedTrackCount, sharedTracks]): CollaborationInfo => ({
        artist: artistName,
        sharedTrackCount,
        sharedTracks: [...sharedTracks],
      })
    ),
  }));

  const topArtist = artists[0] ?? null;

  const podium: PodiumEntry[] = artists.slice(0, 3).map((artist, index) => {
    const entry: PodiumEntry = {
      rank: (index + 1) as PodiumEntry['rank'],
      artist,
      featuredTracks: pickFeaturedTracks(artist.tracks),
    };
    const thumbnailUrl = wire.th?.[index];
    if (thumbnailUrl) entry.thumbnailUrl = thumbnailUrl;
    return entry;
  });

  return {
    platform: PLATFORM_BY_CODE[wire.p],
    playlistId: wire.i,
    playlistTitle: wire.t,
    stats: {
      totalTracks: wire.tt,
      totalArtists: wire.ta,
      topArtist,
      podium,
      artists,
    },
  };
}

/** Réplica de la selección de canciones destacadas del calculador. */
function pickFeaturedTracks(tracks: TrackAppearance[]): string[] {
  const ordered = [...tracks].sort(
    (a, b) => Number(b.isMainArtist) - Number(a.isMainArtist)
  );
  const seen = new Set<string>();
  const featured: string[] = [];

  for (const track of ordered) {
    const dedupeKey = track.trackTitle.trim().toLowerCase();
    if (!dedupeKey || seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    featured.push(track.trackTitle);
    if (featured.length === 3) break;
  }

  return featured;
}

/* ------------------------------------------------------------------ */
/* Base64URL                                                          */
/* ------------------------------------------------------------------ */

function encodeWire(wire: WirePayload): string {
  return encodeBase64Url(new TextEncoder().encode(JSON.stringify(wire)));
}

function decodeBase64Url(value: string): string {
  const unpadded = value.replace(/=+$/, '');

  if (!unpadded || !/^[A-Za-z0-9_-]+$/.test(unpadded)) {
    throw new ShareCodecError(
      'invalid_encoding',
      'El enlace compartido no usa una codificación Base64URL válida.'
    );
  }
  if (unpadded.length % 4 === 1) {
    throw new ShareCodecError('invalid_encoding', 'El enlace compartido está truncado.');
  }

  const base64 = unpadded.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');

  let binary: string;
  try {
    binary = atob(padded);
  } catch {
    throw new ShareCodecError('invalid_encoding', 'El enlace compartido está corrupto.');
  }

  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new ShareCodecError('invalid_encoding', 'El enlace compartido no es UTF-8 válido.');
  }
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/* ------------------------------------------------------------------ */
/* Helpers de validación                                              */
/* ------------------------------------------------------------------ */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPlatformType(value: unknown): value is PlatformType {
  return value === 'youtube_music' || value === 'spotify';
}

function readInteger(value: unknown, min: number, max: number, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value)) {
    throw invalidStructure(`${field} no es un entero.`);
  }
  if (value < min || value > max) {
    throw invalidStructure(`${field} está fuera del rango permitido.`);
  }
  return value;
}

function readText(
  value: unknown,
  maxLength: number,
  field: string,
  allowEmpty = false
): string {
  if (typeof value !== 'string') {
    throw invalidStructure(`${field} no es texto.`);
  }

  const text = value.trim();
  if (!allowEmpty && text.length === 0) {
    throw invalidStructure(`${field} está vacío.`);
  }
  if (text.length > maxLength) {
    throw invalidStructure(`${field} excede el máximo de ${maxLength} caracteres.`);
  }
  if (CONTROL_CHARS.test(text)) {
    throw invalidStructure(`${field} contiene caracteres de control.`);
  }

  return text;
}

function readThumbnailUrl(value: string, index: number): string {
  const text = readText(value, SHARE_LIMITS.thumbnailUrl, `thumbnail[${index}]`);

  let parsed: URL;
  try {
    parsed = new URL(text);
  } catch {
    throw invalidStructure(`thumbnail[${index}] no es una URL válida.`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw invalidStructure(`thumbnail[${index}] debe usar http o https.`);
  }

  return text;
}

function sanitizeText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return value.replace(CONTROL_CHARS, '').trim().slice(0, maxLength);
}

function sanitizeThumbnail(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const text = value.trim();
  if (!text || text.length > SHARE_LIMITS.thumbnailUrl) return null;

  try {
    const parsed = new URL(text);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? text : null;
  } catch {
    return null;
  }
}

function clampInteger(value: unknown, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function invalidStructure(message: string): ShareCodecError {
  return new ShareCodecError('invalid_structure', `Payload compartido inválido: ${message}`);
}

function failure(code: ShareCodecErrorCode, message: string): DecodeShareResult {
  return { ok: false, error: new ShareCodecError(code, message) };
}

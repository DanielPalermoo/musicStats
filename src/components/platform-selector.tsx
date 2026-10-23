'use client';

import { motion } from 'framer-motion';
import { AudioLines, Check, Clock3, Cloud, Music2, Youtube } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { PlatformType } from '@/types/playlist';

/**
 * Identificador de plataforma de la UI. Es más amplio que `PlatformType`
 * porque el catálogo incluye plataformas todavía no soportadas por la API.
 */
export type PlatformId = PlatformType | 'deezer' | 'soundcloud' | (string & {});

export interface PlatformDefinition {
  id: PlatformId;
  name: string;
  description: string;
  /** Indica si el backend ya puede analizar playlists de esta plataforma. */
  available: boolean;
  /** Placeholder del input adaptado a la plataforma. */
  placeholder: string;
  icon: LucideIcon;
  /** Clases (completas, para que Tailwind las detecte) de acento visual. */
  cardGradient: string;
  iconClass: string;
  selectedRing: string;
}

/**
 * Catálogo extensible de plataformas. Para sumar una nueva plataforma basta
 * con agregar otra entrada a este arreglo: el selector la renderiza sola.
 */
export const PLATFORM_CATALOG: PlatformDefinition[] = [
  {
    id: 'youtube_music',
    name: 'YouTube Music',
    description: 'Playlists públicas de YouTube y YouTube Music.',
    available: true,
    placeholder: 'https://music.youtube.com/playlist?list=...',
    icon: Youtube,
    cardGradient: 'from-red-500/25 via-red-500/5 to-transparent',
    iconClass: 'text-red-400',
    selectedRing: 'border-red-400/70 shadow-[0_0_35px_-10px_rgba(248,113,113,0.65)]',
  },
  {
    id: 'spotify',
    name: 'Spotify',
    description: 'Playlists públicas compartidas con enlace.',
    available: true,
    placeholder: 'https://open.spotify.com/playlist/...',
    icon: Music2,
    cardGradient: 'from-emerald-500/25 via-emerald-500/5 to-transparent',
    iconClass: 'text-emerald-400',
    selectedRing: 'border-emerald-400/70 shadow-[0_0_35px_-10px_rgba(52,211,153,0.65)]',
  },
  {
    id: 'deezer',
    name: 'Deezer',
    description: 'Playlists públicas de Deezer con enlace completo o corto.',
    available: true,
    placeholder: 'https://www.deezer.com/playlist/...',
    icon: AudioLines,
    cardGradient: 'from-fuchsia-500/25 via-fuchsia-500/5 to-transparent',
    iconClass: 'text-fuchsia-400',
    selectedRing: 'border-fuchsia-400/70 shadow-[0_0_35px_-10px_rgba(232,121,249,0.65)]',
  },
  {
    id: 'soundcloud',
    name: 'SoundCloud',
    description: 'Sets y playlists públicas de SoundCloud.',
    available: true,
    placeholder: 'https://soundcloud.com/usuario/sets/mi-playlist',
    icon: Cloud,
    cardGradient: 'from-orange-500/25 via-orange-500/5 to-transparent',
    iconClass: 'text-orange-400',
    selectedRing: 'border-orange-400/70 shadow-[0_0_35px_-10px_rgba(251,146,60,0.65)]',
  },
];

export function getPlatformDefinition(id: PlatformId): PlatformDefinition | undefined {
  return PLATFORM_CATALOG.find((platform) => platform.id === id);
}

/** Primera plataforma disponible, usada como selección inicial. */
export function getDefaultPlatform(): PlatformDefinition {
  return PLATFORM_CATALOG.find((platform) => platform.available) ?? PLATFORM_CATALOG[0];
}

function parseHttpUrl(rawUrl: string): URL | string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return 'La URL no es válida. Copia el enlace completo de la playlist, incluyendo https://.';
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return 'El enlace debe comenzar con http:// o https://.';
  }

  return parsed;
}

function validateYouTubeMusic(rawUrl: string): string | null {
  const parsed = parseHttpUrl(rawUrl);
  if (typeof parsed === 'string') return parsed;

  const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
  const isYouTubeHost =
    host === 'youtube.com' || host === 'music.youtube.com' || host.endsWith('.youtube.com');
  const isShortHost = host === 'youtu.be';

  if (!isYouTubeHost && !isShortHost) {
    return 'Ese enlace no parece ser de YouTube Music. Usa un enlace de youtube.com o music.youtube.com.';
  }

  if (isShortHost) {
    if (parsed.pathname.replace(/\//g, '').length === 0) {
      return 'El enlace corto de YouTube no contiene una playlist válida.';
    }
    return null;
  }

  if (!parsed.searchParams.get('list')) {
    return 'El enlace de YouTube debe incluir el parámetro "list" de la playlist.';
  }

  return null;
}

function validateSpotify(rawUrl: string): string | null {
  if (rawUrl.startsWith('spotify:playlist:')) {
    const id = rawUrl.slice('spotify:playlist:'.length).trim();
    return id ? null : 'La URI de Spotify no contiene el ID de una playlist.';
  }

  const parsed = parseHttpUrl(rawUrl);
  if (typeof parsed === 'string') return parsed;

  const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
  if (host !== 'open.spotify.com') {
    return 'Ese enlace no parece ser de Spotify. Usa un enlace de open.spotify.com.';
  }

  if (!parsed.pathname.startsWith('/playlist/')) {
    return 'El enlace de Spotify debe apuntar a una playlist (/playlist/...).';
  }

  return null;
}

function validateDeezer(rawUrl: string): string | null {
  const parsed = parseHttpUrl(rawUrl);
  if (typeof parsed === 'string') return parsed;

  const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();

  // Enlaces cortos de la app: se resuelven en el servidor.
  if (host === 'deezer.page.link' || host === 'link.deezer.com') {
    if (parsed.pathname.replace(/\//g, '').length === 0) {
      return 'El enlace corto de Deezer no contiene una playlist válida.';
    }
    return null;
  }

  if (host !== 'deezer.com' && host !== 'm.deezer.com') {
    return 'Ese enlace no parece ser de Deezer. Usa un enlace de deezer.com.';
  }

  if (!/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?playlist\/\d+/i.test(parsed.pathname)) {
    return 'El enlace de Deezer debe apuntar a una playlist (/playlist/...).';
  }

  return null;
}

const SOUNDCLOUD_RESERVED_SEGMENTS = new Set([
  'discover',
  'search',
  'you',
  'stream',
  'upload',
  'charts',
  'popular',
  'tags',
  'groups',
  'settings',
  'notifications',
  'messages',
  'library',
  'likes',
  'following',
  'followers',
  'pages',
  'pro',
  'premium',
  'artists',
  'playlists',
  'albums',
  'tracks',
  'imprint',
  'jobs',
]);

function validateSoundCloud(rawUrl: string): string | null {
  const parsed = parseHttpUrl(rawUrl);
  if (typeof parsed === 'string') return parsed;

  const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();

  // Enlaces cortos de la app: se resuelven en el servidor.
  if (host === 'on.soundcloud.com') {
    if (parsed.pathname.replace(/\//g, '').length === 0) {
      return 'El enlace corto de SoundCloud no contiene un set válido.';
    }
    return null;
  }

  if (host !== 'soundcloud.com' && host !== 'm.soundcloud.com') {
    return 'Ese enlace no parece ser de SoundCloud. Usa un enlace de soundcloud.com.';
  }

  const setMatch = parsed.pathname.match(/^\/([^/]+)\/sets\/([^/?#]+)/i);
  if (setMatch) {
    if (SOUNDCLOUD_RESERVED_SEGMENTS.has(setMatch[1].toLowerCase())) {
      return 'Ese enlace de SoundCloud no corresponde a un set de usuario.';
    }
    return null;
  }

  if (/^\/sets\/[^/?#]+/i.test(parsed.pathname)) return null;

  return 'El enlace de SoundCloud debe apuntar a un set (/usuario/sets/...).';
}

/**
 * Valida el enlace según la plataforma seleccionada.
 * Devuelve un mensaje de error o `null` si es válido.
 */
export function validatePlaylistUrl(platformId: PlatformId, rawUrl: string): string | null {
  const url = rawUrl.trim();
  if (!url) return 'Ingresa el enlace de una playlist.';

  switch (platformId) {
    case 'youtube_music':
      return validateYouTubeMusic(url);
    case 'spotify':
      return validateSpotify(url);
    case 'deezer':
      return validateDeezer(url);
    case 'soundcloud':
      return validateSoundCloud(url);
    default:
      return 'La plataforma seleccionada no está soportada.';
  }
}

interface PlatformSelectorProps {
  selected: PlatformId;
  onSelect: (platform: PlatformDefinition) => void;
}

/**
 * Selector de plataformas en formato de tarjetas interactivas.
 */
export function PlatformSelector({ selected, onSelect }: PlatformSelectorProps) {
  return (
    <section aria-labelledby="platform-selector-title" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="platform-selector-title" className="text-sm font-semibold text-zinc-200">
            1. Elige la plataforma
          </h2>
          <p className="text-xs text-zinc-500">
            El catálogo es extensible: YouTube Music, Spotify, Deezer y SoundCloud ya están
            disponibles.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {PLATFORM_CATALOG.map((platform, index) => {
          const isSelected = platform.id === selected;
          const Icon = platform.icon;

          return (
            <motion.button
              key={platform.id}
              type="button"
              disabled={!platform.available}
              aria-pressed={isSelected}
              aria-label={
                platform.available
                  ? `Seleccionar ${platform.name}`
                  : `${platform.name} (próximamente)`
              }
              onClick={() => onSelect(platform)}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.3 }}
              whileHover={platform.available ? { y: -3 } : undefined}
              whileTap={platform.available ? { scale: 0.98 } : undefined}
              className={`group relative overflow-hidden rounded-2xl border bg-zinc-900/70 p-4 text-left transition-colors ${
                isSelected && platform.available
                  ? platform.selectedRing
                  : 'border-zinc-800 hover:border-zinc-700'
              } ${platform.available ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
            >
              <div
                aria-hidden="true"
                className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${platform.cardGradient} ${
                  isSelected ? 'opacity-100' : 'opacity-40 group-hover:opacity-80'
                } transition-opacity`}
              />

              <div className="relative flex items-start justify-between gap-2">
                <span className="rounded-xl bg-zinc-950/60 p-2 ring-1 ring-white/10">
                  <Icon className={`h-5 w-5 ${platform.iconClass}`} aria-hidden="true" />
                </span>

                {platform.available ? (
                  isSelected ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                      <Check className="h-3 w-3" aria-hidden="true" /> Activa
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-zinc-800/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-300">
                      Disponible
                    </span>
                  )
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-zinc-800/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                    <Clock3 className="h-3 w-3" aria-hidden="true" /> Próximamente
                  </span>
                )}
              </div>

              <p className="relative mt-3 text-sm font-semibold text-zinc-100">{platform.name}</p>
              <p className="relative mt-0.5 line-clamp-2 text-[11px] leading-snug text-zinc-400">
                {platform.description}
              </p>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}

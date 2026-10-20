'use client';

import { useEffect, useState } from 'react';
import { getInitials } from '@/lib/format';

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

const SIZE_CLASSES: Record<AvatarSize, string> = {
  sm: 'h-10 w-10 text-xs',
  md: 'h-14 w-14 text-sm',
  lg: 'h-20 w-20 text-lg',
  xl: 'h-24 w-24 text-xl',
};

interface ArtistAvatarProps {
  name: string;
  src?: string;
  size?: AvatarSize;
  /** Clases extra para el contenedor (por ejemplo, el anillo del podio). */
  className?: string;
}

/**
 * Avatar circular con foto remota y respaldo de iniciales cuando la imagen
 * no está disponible o falla al cargar.
 */
export function ArtistAvatar({ name, src, size = 'md', className = '' }: ArtistAvatarProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const showImage = Boolean(src) && !failed;

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900 font-bold tracking-wide text-zinc-200 ring-2 ring-white/10 ${SIZE_CLASSES[size]} ${className}`}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={`Foto de ${name}`}
          loading="lazy"
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span aria-hidden="true">{getInitials(name)}</span>
      )}
    </span>
  );
}

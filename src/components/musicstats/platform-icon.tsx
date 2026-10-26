import type { PlatformId } from '@/lib/musicstats/types'
import { cn } from '@/lib/utils'

type Props = { platform: PlatformId; className?: string }

export function PlatformIcon({ platform, className }: Props) {
  const common = { className: cn('size-5', className), viewBox: '0 0 24 24', 'aria-hidden': true } as const

  switch (platform) {
    case 'youtube':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" fill="currentColor" />
          <circle cx="12" cy="12" r="5.5" fill="none" stroke="#09090b" strokeWidth="1.4" />
          <path d="M10.4 9.6v4.8l4.1-2.4z" fill="#09090b" />
        </svg>
      )
    case 'spotify':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" fill="currentColor" />
          <g fill="none" stroke="#09090b" strokeLinecap="round">
            <path d="M7 9.4c3.4-1 7.2-.7 10.2 1" strokeWidth="1.7" />
            <path d="M7.6 12.4c2.8-.8 5.8-.5 8.3.9" strokeWidth="1.5" />
            <path d="M8.2 15.2c2.2-.6 4.4-.4 6.3.7" strokeWidth="1.3" />
          </g>
        </svg>
      )
    case 'deezer':
      return (
        <svg {...common} fill="currentColor">
          <rect x="2" y="15" width="4" height="4" rx="0.8" />
          <rect x="7" y="11" width="4" height="8" rx="0.8" />
          <rect x="12" y="7" width="4" height="12" rx="0.8" />
          <rect x="17" y="4" width="4" height="15" rx="0.8" />
        </svg>
      )
    case 'soundcloud':
      return (
        <svg {...common} fill="currentColor">
          <path d="M11 8.2a5.5 5.5 0 0 1 9.4 3.3A3.3 3.3 0 0 1 19.7 18H11z" />
          <rect x="8.6" y="9.5" width="1.4" height="8.5" rx="0.7" />
          <rect x="6.2" y="11" width="1.4" height="7" rx="0.7" />
          <rect x="3.8" y="12.5" width="1.4" height="5.5" rx="0.7" />
          <rect x="1.4" y="14" width="1.4" height="4" rx="0.7" />
        </svg>
      )
    case 'tidal':
      return (
        <svg {...common} fill="currentColor">
          <path d="M6 6l3 3-3 3-3-3zm6 0l3 3-3 3-3-3zm6 0l3 3-3 3-3-3zm-6 6l3 3-3 3-3-3z" />
        </svg>
      )
  }
}

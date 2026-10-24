export function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function formatLongDuration(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  return h > 0 ? `${h} h ${m} min` : `${m} min`
}

export function hashString(value: string) {
  let h = 2166136261
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function gradientFor(seed: string) {
  const h = hashString(seed)
  const hue1 = h % 360
  const hue2 = (hue1 + 40 + (h % 80)) % 360
  const angle = h % 180
  return `linear-gradient(${angle}deg, hsl(${hue1} 75% 52%), hsl(${hue2} 70% 28%))`
}

export function initials(name: string) {
  const parts = name.replace(/[^\p{L}\p{N}\s]/gu, '').trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || name.slice(0, 2).toUpperCase()
}

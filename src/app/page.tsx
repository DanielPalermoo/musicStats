import { MusicStatsApp } from '@/components/musicstats/music-stats-app'

export default async function Page({ searchParams }: { searchParams: Promise<{ share?: string }> }) {
  const { share } = await searchParams
  return <MusicStatsApp initialUrl={share} />
}

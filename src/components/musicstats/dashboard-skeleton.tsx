function Block({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-white/[0.04] ring-1 ring-white/5 ${className ?? ''}`} />
}

export function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Analizando playlist" className="flex flex-col gap-4">
      <Block className="h-28" />
      <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          <Block className="h-36" />
          <Block className="h-36" />
          <Block className="h-36" />
        </div>
        <Block className="h-[456px]" />
      </div>
      <Block className="h-96" />
    </div>
  )
}

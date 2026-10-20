import { WidgetCard } from '@/components/ron1n'
import { WidgetSkeleton } from '@/components/WidgetSkeleton'
import { Progress } from '@/components/ui/progress'
import { num } from '@/lib/format'
import { useDownloads } from './data'

function eta(seconds = 0) {
  return seconds < 60 ? 'meno di 1 min' : `${Math.round(seconds / 60)} min`
}

export function DownloadsWidget({ className }: { className?: string }) {
  const { data } = useDownloads()
  if (!data) return <WidgetSkeleton title="Download" className={className} />

  const active = data.items.filter((d) => d.state === 'downloading')
  const queued = data.items.filter((d) => d.state === 'queued').length
  const seeding = data.items.filter((d) => d.state === 'seeding').length
  const top = active[0]
  const rest = [
    active.length > 1 && `+${active.length - 1} attivo`,
    queued && `${queued} in coda`,
    seeding && `${seeding} in seed`,
  ].filter(Boolean)

  return (
    <WidgetCard title="Download" meta={`↓ ${num(data.speedMBs, 1)} MB/s`} className={className}>
      {top ? (
        <div className="flex flex-col gap-2.5">
          <div className="flex justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{top.name}</span>
            <span className="font-mono">{top.progress}%</span>
          </div>
          <Progress value={top.progress} glow aria-label={`${top.name} ${top.progress}%`} />
          <div className="font-mono text-xs text-ink-muted">{eta(top.etaSeconds)} rimanenti</div>
        </div>
      ) : (
        <div className="text-sm text-ink-muted">Nessun download attivo.</div>
      )}
      {rest.length ? <div className="text-[13px] text-ink-muted">{rest.join(' · ')}</div> : null}
    </WidgetCard>
  )
}

import { ProgressRing, WidgetCard } from '@/components/ron1n'
import { WidgetSkeleton } from '@/components/WidgetSkeleton'
import { rate } from '@/lib/format'
import { ALERT_THRESHOLD, headerMeta, percent, useServerStats } from './data'

export function ServerWidget({ className }: { className?: string }) {
  const { data } = useServerStats()
  if (!data) return <WidgetSkeleton title="Server" className={className} />

  const rings = [
    { key: 'CPU', value: percent(data.cpu) },
    { key: 'RAM', value: percent(data.ram) },
    { key: 'SSD', value: percent(data.disk) },
  ]

  return (
    <WidgetCard title="Server" meta={headerMeta(data)} className={className}>
      <div className="grid grid-cols-3 justify-items-center gap-2">
        {rings.map((r) => {
          const alert = r.value >= ALERT_THRESHOLD
          return (
            <ProgressRing
              key={r.key}
              value={r.value}
              size={84}
              tone={alert ? 'brand' : 'ink'}
              label={`${r.value}%`}
              caption={r.key}
              ariaLabel={`${r.key} ${r.value}%${alert ? ', sopra soglia' : ''}`}
            />
          )
        })}
      </div>
      {data.net ? (
        <div className="flex items-baseline justify-between gap-3 border-t border-glass-border pt-3.5">
          <span className="text-[13px] text-ink-muted">Rete</span>
          <span className="font-mono text-sm">
            ↓ {rate(data.net.rxBps)} · ↑ {rate(data.net.txBps)}
          </span>
        </div>
      ) : null}
    </WidgetCard>
  )
}

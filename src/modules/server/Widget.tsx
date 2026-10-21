import { ProgressRing, WidgetCard } from '@/components/ron1n'
import { WidgetSkeleton } from '@/components/WidgetSkeleton'
import { bytes, num, rate } from '@/lib/format'
import { ALERT_THRESHOLD, headerMeta, percent, topContainers, useServerStats } from './data'

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
      {data.containers?.length ? (
        <table className="w-full table-fixed border-t border-glass-border text-sm">
          <thead>
            <tr className="text-xs text-ink-muted">
              <th className="pt-3.5 pb-1 text-left font-normal">Container</th>
              <th className="w-16 pt-3.5 pb-1 text-right font-normal">CPU</th>
              <th className="w-[72px] pt-3.5 pb-1 text-right font-normal">RAM</th>
            </tr>
          </thead>
          <tbody>
            {topContainers(data.containers).map((c) => (
              <tr key={c.name}>
                <td className="truncate py-1">{c.name}</td>
                <td className="py-1 text-right font-mono">{num(c.cpu)}%</td>
                <td className="py-1 text-right font-mono">{bytes(c.memBytes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </WidgetCard>
  )
}

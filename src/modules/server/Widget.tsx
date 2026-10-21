import { ProgressRing, WidgetCard } from '@/components/ron1n'
import { WidgetSkeleton } from '@/components/WidgetSkeleton'
import { ALERT_THRESHOLD, percent, useServerStats } from './data'

export function ServerWidget({ className }: { className?: string }) {
  const { data } = useServerStats()
  if (!data) return <WidgetSkeleton title="Server" className={className} />

  const rings = [
    { key: 'CPU', value: percent(data.cpu) },
    { key: 'RAM', value: percent(data.ram) },
    { key: 'SSD', value: percent(data.disk) },
  ]

  return (
    <WidgetCard
      title="Server"
      meta={`${Math.round(data.tempC)} °C · ${data.uptimeDays} g`}
      className={className}
    >
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
    </WidgetCard>
  )
}

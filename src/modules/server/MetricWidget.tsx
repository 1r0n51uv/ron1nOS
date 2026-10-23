import { Metric, StatusPill, WidgetCard } from '@/components/ron1n'
import { WidgetSkeleton } from '@/components/WidgetSkeleton'
import { Progress } from '@/components/ui/progress'
import { rate } from '@/lib/format'
import type { WidgetProps } from '@/widgets/types'
import { percent, THRESHOLDS, useServerStats } from './data'

const TITLES = { cpu: 'CPU', ram: 'RAM', disk: 'Disco', net: 'Rete' } as const
type Resource = keyof typeof TITLES

// Una sola risorsa del server, scelta nelle opzioni (DASH-002, DASH-005).
// Compatta mostra solo il valore, dettagliata aggiunge la barra.
export function ServerMetricWidget({ className, variant, options }: WidgetProps) {
  const resource = ((options?.metric as Resource | undefined) ?? 'cpu') satisfies Resource
  const title = TITLES[resource]
  const { data, isError } = useServerStats()
  if (isError) {
    return (
      <WidgetCard title={title} meta="offline" className={className}>
        <div className="flex">
          <StatusPill tone="alert" size="small">
            Glances · offline
          </StatusPill>
        </div>
      </WidgetCard>
    )
  }
  if (!data) return <WidgetSkeleton title={title} className={className} />

  if (resource === 'net') {
    return (
      <WidgetCard title={title} meta="server" className={className}>
        {data.net ? (
          <div className="flex flex-col gap-1.5 font-mono">
            <span className="text-[22px] leading-7">↓ {rate(data.net.rxBps)}</span>
            <span className="text-sm text-ink-muted">↑ {rate(data.net.txBps)}</span>
          </div>
        ) : (
          <div className="text-sm text-ink-muted">Rete non disponibile.</div>
        )}
      </WidgetCard>
    )
  }

  const value = percent(data[resource])
  const alert = value >= THRESHOLDS.percent
  return (
    <WidgetCard title={title} meta="server" className={className}>
      <Metric value={`${value}%`} size="md" />
      {variant === 'compact' ? null : (
        <Progress
          value={value}
          aria-label={`${title} ${value}%${alert ? ', sopra soglia' : ''}`}
          // Rosso solo sopra soglia, come gli anelli del summary (SRV-005).
          className={alert ? undefined : '[&>[data-slot=progress-indicator]]:bg-ink'}
        />
      )}
    </WidgetCard>
  )
}

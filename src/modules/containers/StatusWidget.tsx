import { Metric, WidgetCard } from '@/components/ron1n'
import { WidgetSkeleton } from '@/components/WidgetSkeleton'
import type { WidgetProps } from '@/widgets/types'
import { summarize, useContainers } from './data'

// Solo il conteggio dei container (DASH-002); l'elenco resta nel summary.
export function ContainerStatusWidget({ className }: WidgetProps) {
  const { data } = useContainers()
  if (!data) return <WidgetSkeleton title="Container" className={className} />

  const { total, running, down } = summarize(data)
  return (
    <WidgetCard title="Container" action={{ label: 'Gestisci', to: '/server' }} className={className}>
      <Metric value={`${running}/${total}`} size="md" />
      {down.length ? (
        <span className="text-[13px] text-brand-text">
          <span className="font-mono">{down.length}</span> {down.length === 1 ? 'fermo' : 'fermi'}
        </span>
      ) : (
        <span className="text-[13px] text-ink-muted">tutti attivi</span>
      )}
    </WidgetCard>
  )
}

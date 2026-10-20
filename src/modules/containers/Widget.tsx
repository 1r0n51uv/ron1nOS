import { AlertRow, Metric, WidgetCard } from '@/components/ron1n'
import { WidgetSkeleton } from '@/components/WidgetSkeleton'
import { summarize, useContainers, useRestartContainer } from './data'

export function ContainersWidget({ className }: { className?: string }) {
  const { data } = useContainers()
  const restart = useRestartContainer()
  if (!data) return <WidgetSkeleton title="Container" className={className} />

  const { total, running, down } = summarize(data)

  return (
    <WidgetCard title="Container" action={{ label: 'Gestisci', to: '/server' }} className={className}>
      <Metric value={String(running)} unit={`di ${total} attivi`} />
      {down.map((c) => (
        <AlertRow
          key={c.name}
          title={c.name}
          body={c.note}
          actionLabel="Riavvia"
          pending={restart.isPending && restart.variables === c.name}
          onAction={() => restart.mutate(c.name)}
        />
      ))}
    </WidgetCard>
  )
}

import { ToggleTile, WidgetCard } from '@/components/ron1n'
import { WidgetSkeleton } from '@/components/WidgetSkeleton'
import { useDevices, useToggleDevice } from './data'

export function HomeWidget({ className }: { className?: string }) {
  const { data } = useDevices()
  const toggle = useToggleDevice()
  if (!data) return <WidgetSkeleton title="Casa" className={className} />

  return (
    <WidgetCard title="Casa" action={{ label: 'Tutti', to: '/casa' }} className={className}>
      <div className="grid grid-cols-2 gap-3">
        {data.map((d) => (
          <ToggleTile
            key={d.id}
            name={d.name}
            meta={d.meta}
            on={d.on}
            onChange={(on) => toggle.mutate({ id: d.id, on })}
          />
        ))}
      </div>
    </WidgetCard>
  )
}

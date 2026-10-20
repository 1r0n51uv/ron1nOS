import { Metric, Sparkline, WidgetCard } from '@/components/ron1n'
import { WidgetSkeleton } from '@/components/WidgetSkeleton'
import { num, signed } from '@/lib/format'
import { useWeight } from './data'

export function WeightWidget({ className }: { className?: string }) {
  const { data } = useWeight()
  if (!data) return <WidgetSkeleton title="Peso" className={className} />

  const first = data.points[0] ?? 0
  const last = data.points.at(-1) ?? 0
  const delta = signed(last - first)
  const aria = `Peso da ${num(first, 1)} a ${num(last, 1)} kg in ${data.days} giorni`

  return (
    <WidgetCard title="Peso" meta={`${data.days} giorni`} className={className}>
      <Metric value={num(last, 1)} unit="kg" delta={delta} />
      <Sparkline points={data.points} ariaLabel={aria} />
    </WidgetCard>
  )
}

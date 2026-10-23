import { Metric, Sparkline, WidgetCard } from '@/components/ron1n'
import { WidgetSkeleton } from '@/components/WidgetSkeleton'
import { num, signed } from '@/lib/format'
import { useFormats } from '@/preferences/data'
import type { WidgetProps } from '@/widgets/types'
import { useWeight } from './data'

// Variante `compact`: solo il valore, senza andamento (DASH-005).
export function WeightWidget({ className, variant }: WidgetProps) {
  const { data } = useWeight()
  const fmt = useFormats()
  if (!data) return <WidgetSkeleton title="Peso" className={className} />

  // Nell'unità scelta (SET-010); i dati restano in kg.
  const points = data.points.map(fmt.weight)
  const first = points[0] ?? 0
  const last = points.at(-1) ?? 0
  const delta = signed(last - first)
  const aria = `Peso da ${num(first, 1)} a ${num(last, 1)} ${fmt.weightUnit} in ${data.days} giorni`

  return (
    <WidgetCard title="Peso" meta={`${data.days} giorni`} className={className}>
      <Metric value={num(last, 1)} unit={fmt.weightUnit} delta={delta} />
      {variant === 'compact' ? null : <Sparkline points={points} ariaLabel={aria} />}
    </WidgetCard>
  )
}

import { AlertRow, ProgressRing, SegmentedProgress, WidgetCard } from '@/components/ron1n'
import { WidgetSkeleton } from '@/components/WidgetSkeleton'
import { useNow } from '@/hooks/useNow'
import { ApiError } from '@/lib/api'
import { num } from '@/lib/format'
import type { WidgetProps } from '@/widgets/types'
import { SLOT_LABELS, useDay } from './data'
import { todayRome } from './dates'
import { plannedLine } from './format'

// Widget piccoli della Nutrizione (DASH-002): leggono lo stesso giorno di
// NutritionWidget, senza rotte nuove.
function useToday() {
  return useDay(todayRome(useNow()))
}

function Unavailable({ title, error, className }: { title: string; error: unknown; className?: string }) {
  return (
    <WidgetCard title={title} action={{ label: 'Dettagli', to: '/pasti' }} className={className}>
      <AlertRow
        title="Diario non disponibile."
        body={error instanceof ApiError ? error.message : 'Backend non raggiungibile'}
      />
    </WidgetCard>
  )
}

export function CaloriesWidget({ className }: WidgetProps) {
  const { data, error } = useToday()
  if (!data && error) return <Unavailable title="Calorie" error={error} className={className} />
  if (!data) return <WidgetSkeleton title="Calorie" className={className} />

  const target = data.quota?.kcal ?? 0
  const eaten = data.totals.kcal
  return (
    <WidgetCard title="Calorie" action={{ label: 'Dettagli', to: '/pasti' }} className={className}>
      <div className="flex justify-center">
        <ProgressRing
          value={eaten}
          max={target || Math.max(eaten, 1)}
          label={num(eaten)}
          sublabel={target ? `di ${num(target)} kcal` : 'kcal'}
          ariaLabel={target ? `${num(eaten)} kcal su ${num(target)}` : `${num(eaten)} kcal`}
        />
      </div>
    </WidgetCard>
  )
}

export function NextMealWidget({ className }: WidgetProps) {
  const { data, error } = useToday()
  if (!data && error) return <Unavailable title="Prossimo pasto" error={error} className={className} />
  if (!data) return <WidgetSkeleton title="Prossimo pasto" className={className} />

  return (
    <WidgetCard title="Prossimo pasto" action={{ label: 'Dettagli', to: '/pasti' }} className={className}>
      {data.nextSlot ? (
        <div className="flex min-w-0 flex-col gap-1">
          <div className="font-display text-lg font-semibold">{SLOT_LABELS[data.nextSlot]}</div>
          <div className="truncate font-mono text-[13px] text-ink-muted">{plannedLine(data)}</div>
        </div>
      ) : (
        <div className="font-display text-lg font-semibold">Pasti completati</div>
      )}
    </WidgetCard>
  )
}

export function SupplementsWidget({ className }: WidgetProps) {
  const { data, error } = useToday()
  if (!data && error) return <Unavailable title="Integratori" error={error} className={className} />
  if (!data) return <WidgetSkeleton title="Integratori" className={className} />

  const list = data.supplements
  const done = list.filter((s) => s.taken).length
  const missing = list.filter((s) => !s.taken)
  return (
    <WidgetCard title="Integratori" action={{ label: 'Dettagli', to: '/pasti' }} className={className}>
      {list.length === 0 ? (
        <div className="text-sm text-ink-muted">Nessun integratore attivo.</div>
      ) : (
        <div className="flex flex-col gap-2.5">
          <SegmentedProgress
            total={list.length}
            done={done}
            label={`${done} di ${list.length} integratori`}
          />
          <div className="truncate text-[13px] text-ink-muted">
            {missing.length ? `Mancano ${missing.map((s) => s.name).join(' · ')}` : 'Tutti presi.'}
          </div>
        </div>
      )}
    </WidgetCard>
  )
}

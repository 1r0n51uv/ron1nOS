import { AlertRow, ProgressRing, WidgetCard } from '@/components/ron1n'
import { WidgetSkeleton } from '@/components/WidgetSkeleton'
import { Progress } from '@/components/ui/progress'
import { useNow } from '@/hooks/useNow'
import { ApiError } from '@/lib/api'
import { num } from '@/lib/format'
import type { WidgetProps } from '@/widgets/types'
import type { Day } from './data'
import { SLOT_LABELS, useDay } from './data'
import { todayRome } from './dates'

const MACROS = [
  { key: 'protein', label: 'Proteine' },
  { key: 'carbs', label: 'Carboidrati' },
  { key: 'fat', label: 'Grassi' },
] as const

const pct = (value: number, max: number) => (max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0)

// Cosa c'è nel prossimo pasto: la ricetta o gli alimenti pianificati.
function plannedLine(day: Day) {
  const slot = day.slots.find((s) => s.slot === day.nextSlot)
  const planned = slot?.state === 'planned' ? slot.planned : null
  if (!planned) return 'Niente pianificato'
  const what = planned.recipeName ?? planned.items.map((i) => i.name).join(', ')
  return `${what} · ${num(planned.kcal)} kcal`
}

// Widget della dashboard (NUT-001): la giornata di oggi.
// Le macro mostrate si scelgono nelle opzioni (DASH-005); senza, tutte.
export function NutritionWidget({ className, options }: WidgetProps) {
  const shown = (options?.macros as readonly string[] | undefined) ?? MACROS.map((m) => m.key)
  const today = todayRome(useNow())
  const { data, error } = useDay(today)
  if (!data && error) {
    return (
      <WidgetCard title="Nutrizione" action={{ label: 'Dettagli', to: '/pasti' }} className={className}>
        <AlertRow
          title="Diario non disponibile."
          body={error instanceof ApiError ? error.message : 'Backend non raggiungibile'}
        />
      </WidgetCard>
    )
  }
  if (!data) return <WidgetSkeleton title="Nutrizione" className={className} />

  const target = data.quota?.kcal ?? 0
  const eaten = data.totals.kcal

  return (
    <WidgetCard title="Nutrizione" action={{ label: 'Dettagli', to: '/pasti' }} className={className}>
      <div className="flex flex-col gap-[18px]">
        <div className="flex items-center gap-6">
          <ProgressRing
            value={eaten}
            max={target || Math.max(eaten, 1)}
            label={num(eaten)}
            sublabel={target ? `di ${num(target)} kcal` : 'kcal'}
            ariaLabel={target ? `${num(eaten)} kcal su ${num(target)}` : `${num(eaten)} kcal`}
          />
          <div className="flex min-w-0 flex-col gap-1.5">
            {data.nextSlot ? (
              <>
                <div className="text-[13px] text-ink-muted">Prossimo pasto</div>
                <div className="font-display text-lg font-semibold">{SLOT_LABELS[data.nextSlot]}</div>
                <div className="truncate font-mono text-[13px] text-ink-muted">{plannedLine(data)}</div>
              </>
            ) : (
              <>
                <div className="font-display text-lg font-semibold">Pasti completati</div>
                {target ? (
                  <div className="text-[13px] text-ink-muted">
                    Restano <span className="font-mono">{num(Math.max(0, target - eaten))} kcal</span>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-3">
          {MACROS.filter((m) => shown.includes(m.key)).map((m) => {
            const value = data.totals[m.key]
            const max = data.goal?.[m.key] ?? 0
            const text = max ? `${num(value)} / ${num(max)} g` : `${num(value)} g`
            return (
              <div key={m.key} className="flex flex-col gap-1.5">
                <div className="flex justify-between text-[13px]">
                  <span>{m.label}</span>
                  <span className="font-mono">{text}</span>
                </div>
                <Progress value={pct(value, max)} aria-label={`${m.label} ${text}`} />
              </div>
            )
          })}
        </div>
      </div>
    </WidgetCard>
  )
}

import { ProgressRing, WidgetCard } from '@/components/ron1n'
import { Progress } from '@/components/ui/progress'
import { num } from '@/lib/format'
import { useFormats } from '@/preferences/data'
import type { FormatTools } from '@/preferences/formats'
import type { Day } from '../data'
import { energyText, ringLabels } from '../format'

const MACROS = [
  { key: 'protein', label: 'Proteine' },
  { key: 'carbs', label: 'Carboidrati' },
  { key: 'fat', label: 'Grassi' },
] as const

const pct = (value: number, max: number) => (max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0)

// Riepilogo del giorno scelto (NUT-002): kcal sulla quota del giorno
// (NUT-016) e macro.
export function DaySummary({ day, title }: { day: Day; title: string }) {
  const fmt = useFormats()
  const target = day.quota?.kcal ?? 0
  const eaten = day.totals.kcal
  const left = Math.max(0, target - eaten)

  return (
    <WidgetCard title={title} meta={quotaMeta(day.quota, fmt)}>
      <div className="flex flex-col gap-[18px]">
        <div className="flex items-center gap-5">
          <ProgressRing
            value={eaten}
            max={target || Math.max(eaten, 1)}
            {...ringLabels(eaten, target, fmt)}
          />
          <dl className="m-0 flex flex-col gap-1.5 text-[13px]">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted">Pianificato</dt>
              <dd className="m-0 font-mono">{num(fmt.energy(day.plannedKcal))}</dd>
            </div>
            {target ? (
              <div className="flex justify-between gap-4">
                <dt className="text-ink-muted">Restano</dt>
                <dd className="m-0 font-mono">{num(fmt.energy(left))}</dd>
              </div>
            ) : null}
          </dl>
        </div>
        <div className="flex flex-col gap-3">
          {MACROS.map((m) => {
            const value = day.totals[m.key]
            const max = day.goal?.[m.key] ?? 0
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

function quotaMeta(quota: Day['quota'], fmt: FormatTools) {
  if (!quota) return 'senza obiettivo'
  if (!quota.activityKcal) return `obiettivo ${energyText(quota.kcal, fmt)}`
  return `obiettivo ${num(fmt.energy(quota.baseKcal))} · attività +${energyText(quota.activityKcal, fmt)}`
}

import { ProgressRing, WidgetCard } from '@/components/ron1n'
import { WidgetSkeleton } from '@/components/WidgetSkeleton'
import { num } from '@/lib/format'
import { kcalEaten, nextMeal, useNutrition } from './data'

export function NutritionWidget({ className }: { className?: string }) {
  const { data } = useNutrition()
  if (!data) return <WidgetSkeleton title="Nutrizione" className={className} />

  const eaten = kcalEaten(data)
  const next = nextMeal(data)

  return (
    <WidgetCard title="Nutrizione" action={{ label: 'Dettagli', to: '/pasti' }} className={className}>
      <div className="flex items-center gap-6">
        <ProgressRing
          value={eaten}
          max={data.kcalTarget}
          label={String(eaten)}
          sublabel={`di ${data.kcalTarget} kcal`}
          ariaLabel={`${num(eaten)} kcal su ${num(data.kcalTarget)}`}
        />
        <div className="flex min-w-0 flex-col gap-1.5">
          {next ? (
            <>
              <div className="text-[13px] text-ink-muted">Prossimo pasto</div>
              <div className="text-lg font-semibold">{next.name}</div>
              <div className="text-[13px] text-ink-muted">
                {next.dish} · {next.kcal} kcal
              </div>
            </>
          ) : (
            <div className="text-lg font-semibold">Pasti completati</div>
          )}
        </div>
      </div>
    </WidgetCard>
  )
}

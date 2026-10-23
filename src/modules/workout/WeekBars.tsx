import { num, shortDay } from '@/lib/format'
import { cn } from '@/lib/utils'
import { weeklyAverage, workouts } from './format'

// Allenamenti per settimana (GYM-001, GYM-013): una barra per settimana,
// l'ultima è quella corrente ed è l'unica in rosso. Con `average` una riga
// tratteggiata segna la media.
export function WeekBars({
  weeks,
  average = false,
  height = 120,
  className,
}: {
  weeks: { monday: string; count: number }[]
  average?: boolean
  height?: number
  className?: string
}) {
  const mean = weeklyAverage(weeks)
  const top = Math.max(1, ...weeks.map((w) => w.count))
  const pct = (v: number) => `${(v / top) * 100}%`
  const first = weeks[0]
  const label = first
    ? `Allenamenti per settimana dal ${shortDay(first.monday)}: questa settimana ${workouts(weeks.at(-1)!.count)}${
        average ? `, media ${num(mean, 1)}` : ''
      }`
    : 'Allenamenti per settimana'

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div
        role="img"
        aria-label={label}
        className="relative flex items-end gap-1 border-b border-glass-border"
        style={{ height }}
      >
        {weeks.map((w, i) => (
          <div key={w.monday} className="relative h-full flex-1" data-week={w.monday}>
            {w.count ? (
              <div
                className={cn(
                  'absolute inset-x-0 bottom-0 rounded-t-[3px]',
                  i === weeks.length - 1 ? 'bg-brand' : 'bg-ink/45',
                )}
                style={{ height: pct(w.count) }}
              />
            ) : null}
          </div>
        ))}
        {average && mean > 0 ? (
          <div
            aria-hidden="true"
            className="absolute inset-x-0 border-t border-dashed border-ink/60"
            style={{ bottom: pct(mean) }}
          />
        ) : null}
      </div>
      {average ? (
        <div className="flex justify-between font-mono text-xs text-ink-muted">
          <span>{first ? shortDay(first.monday) : ''}</span>
          <span>media {num(mean, 1)} a settimana</span>
          <span>questa settimana</span>
        </div>
      ) : null}
    </div>
  )
}

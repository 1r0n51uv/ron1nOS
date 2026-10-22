import { Link } from 'react-router'

import { cn } from '@/lib/utils'
import { dayOfMonth, stripDays, weekdayShort } from '../dates'

// Striscia dei giorni (NUT-002): 10 indietro, oggi, 13 avanti. Il giorno
// scelto sta nell'URL (?giorno=), così si può ricaricare o condividere.
export function DayStrip({ today, selected }: { today: string; selected: string }) {
  return (
    <nav aria-label="Giorni" className="flex gap-1 overflow-x-auto rounded-tile p-2 glass-panel">
      {stripDays(today).map((day) => {
        const isToday = day === today
        return (
          <Link
            key={day}
            to={isToday ? '/pasti' : `/pasti?giorno=${day}`}
            aria-current={day === selected ? 'date' : undefined}
            aria-label={isToday ? 'Oggi' : undefined}
            className={cn(
              'flex h-16 min-w-14 flex-col items-center justify-center gap-0.5 rounded-control border border-transparent text-xs text-ink-muted no-underline hover:bg-glass',
              day === selected && 'border-brand-line bg-glass-strong text-ink',
            )}
          >
            {isToday ? 'oggi' : weekdayShort(day)}
            <b className="font-mono text-lg font-medium text-ink">{dayOfMonth(day)}</b>
          </Link>
        )
      })}
    </nav>
  )
}

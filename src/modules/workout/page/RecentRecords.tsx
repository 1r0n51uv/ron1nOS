import { Link } from 'react-router'

import { AlertRow, WidgetCard } from '@/components/ron1n'
import { WidgetSkeleton } from '@/components/WidgetSkeleton'
import { ApiError } from '@/lib/api'
import { useRecords } from '../data'
import { recordLabel, workoutDay } from '../format'
import { ExercisePhoto } from '../images/ExercisePhoto'

// Nuovi record (GYM-010): al massimo 3 degli ultimi 30 giorni, dal più
// recente, con la miniatura dell'esercizio. Un clic apre la sessione.
export function RecentRecords({ today }: { today: string }) {
  const { data, error } = useRecords()

  if (!data && error) {
    return (
      <WidgetCard title="Nuovi record">
        <AlertRow
          title="Record non disponibili."
          body={error instanceof ApiError ? error.message : 'Backend non raggiungibile'}
        />
      </WidgetCard>
    )
  }
  if (!data) return <WidgetSkeleton title="Nuovi record" />

  return (
    <section aria-label="Nuovi record">
      <WidgetCard title="Nuovi record" meta="ultimi 30 giorni">
        {data.length ? (
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
            {data.map((r) => (
              <li key={`${r.sessionId}-${r.exercise.key}`}>
                <Link
                  to={`/allenamenti/sessioni/${r.sessionId}`}
                  className="flex min-h-14 items-center gap-3 rounded-[12px] px-2 py-1.5 text-ink no-underline hover:bg-glass-hover"
                >
                  <ExercisePhoto
                    name={r.exercise.name}
                    image={r.exercise.image}
                    className="size-11 shrink-0 rounded-[10px]"
                    compact
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{r.exercise.name}</div>
                    <div className="truncate font-mono text-xs text-ink-muted">{recordLabel(r)}</div>
                  </div>
                  <span className="shrink-0 text-xs text-ink-muted">{workoutDay(r.day, today)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-sm text-ink-muted">Nessun record negli ultimi 30 giorni.</div>
        )}
      </WidgetCard>
    </section>
  )
}

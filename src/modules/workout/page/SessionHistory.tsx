import { useState } from 'react'
import { Link } from 'react-router'

import { AlertRow, WidgetCard } from '@/components/ron1n'
import { WidgetSkeleton } from '@/components/WidgetSkeleton'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { SessionRow } from '../data'
import { useRoutines, useSessions } from '../data'
import { duration, workoutDay } from '../format'
import { ExercisePhoto } from '../images/ExercisePhoto'

function Row({ session, today }: { session: SessionRow; today: string }) {
  const when = [
    workoutDay(session.day, today),
    session.durationSeconds ? duration(session.durationSeconds) : null,
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <li>
      <Link
        to={`/allenamenti/sessioni/${session.id}`}
        className="flex min-h-14 items-center gap-4 rounded-[14px] px-2 py-1.5 text-ink no-underline hover:bg-glass-hover"
      >
        <div className="flex shrink-0 gap-1.5" aria-hidden="true">
          {session.exercises.map((e) => (
            <ExercisePhoto
              key={e.name}
              name={e.name}
              image={e.image}
              className="size-11 rounded-[10px]"
              compact
            />
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{session.routine || 'Allenamento'}</div>
          <div className="font-mono text-xs text-ink-muted">{when}</div>
        </div>
      </Link>
    </li>
  )
}

// Storico delle sessioni (GYM-004): miniature dei primi tre esercizi,
// routine, giorno e durata. Filtro per routine, pagine da 20.
export function SessionHistory({ today }: { today: string }) {
  const [routine, setRoutine] = useState<string | null>(null)
  const routines = useRoutines().data?.routines ?? []
  const { data, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useSessions(routine)
  const sessions = data?.pages.flatMap((p) => p.sessions) ?? []

  if (!data && error) {
    return (
      <WidgetCard title="Storico">
        <AlertRow
          title="Storico non disponibile."
          body={error instanceof ApiError ? error.message : 'Backend non raggiungibile'}
        />
      </WidgetCard>
    )
  }
  if (!data) return <WidgetSkeleton title="Storico" />

  const chip = (value: string | null, label: string) => (
    <button
      key={label}
      type="button"
      role="radio"
      aria-checked={routine === value}
      onClick={() => setRoutine(value)}
      className={cn(
        'min-h-8 cursor-pointer rounded-full px-3 text-[13px] glass-chip',
        routine === value ? 'border-brand-line text-brand-text' : 'text-ink-muted hover:bg-glass-hover',
      )}
    >
      {label}
    </button>
  )

  return (
    <section aria-label="Storico">
      <WidgetCard title="Storico">
        {routines.length > 1 ? (
          <div role="radiogroup" aria-label="Routine" className="flex flex-wrap gap-2">
            {chip(null, 'Tutte')}
            {routines.map((r) => chip(r, r))}
          </div>
        ) : null}
        <ul aria-label="Sessioni" className="m-0 flex list-none flex-col gap-0.5 p-0">
          {sessions.map((s) => (
            <Row key={s.id} session={s} today={today} />
          ))}
        </ul>
        {hasNextPage ? (
          <Button
            variant="glass"
            className="self-start"
            disabled={isFetchingNextPage}
            onClick={() => fetchNextPage()}
          >
            Altre sessioni
          </Button>
        ) : null}
      </WidgetCard>
    </section>
  )
}

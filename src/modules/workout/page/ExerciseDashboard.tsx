import { Link } from 'react-router'

import { AlertRow, Sparkline, WidgetCard } from '@/components/ron1n'
import { WidgetSkeleton } from '@/components/WidgetSkeleton'
import { ApiError } from '@/lib/api'
import { useFormats } from '@/preferences/data'
import type { ExerciseRow } from '../data'
import { exercisePath, useExercises } from '../data'
import { exerciseBest } from '../format'
import { ExercisePhoto } from '../images/ExercisePhoto'

export const TOP_EXERCISES = 6

function Card({ exercise }: { exercise: ExerciseRow }) {
  const fmt = useFormats()
  const label = exercise.timed ? 'durata migliore' : '1RM stimato'
  return (
    <li className="min-w-0">
      <Link
        to={exercisePath(exercise.key)}
        className="flex flex-col gap-2 rounded-[16px] p-2 text-ink no-underline glass-chip hover:bg-glass-hover"
      >
        <ExercisePhoto name={exercise.name} image={exercise.image} className="h-20 rounded-[12px]" compact />
        <div className="truncate px-1 text-[13px] font-medium">{exercise.name}</div>
        <div className="flex items-end justify-between gap-2 px-1">
          <div>
            <div className="font-mono text-base leading-5 font-semibold">{exerciseBest(exercise, fmt)}</div>
            <div className="text-[11px] text-ink-muted">{label}</div>
          </div>
          {exercise.trend.length > 1 ? (
            <Sparkline
              points={exercise.trend}
              height={24}
              className="w-1/2"
              ariaLabel={`Andamento ${exercise.name}`}
            />
          ) : null}
        </div>
      </Link>
    </li>
  )
}

// Dashboard esercizi (GYM-007): i 6 più allenati per numero di serie, con
// foto, migliore e andamento. Un clic apre l'esercizio (GYM-008).
export function ExerciseDashboard() {
  const { data, error } = useExercises({ sort: 'sets', limit: TOP_EXERCISES })

  if (!data && error) {
    return (
      <WidgetCard title="Esercizi">
        <AlertRow
          title="Esercizi non disponibili."
          body={error instanceof ApiError ? error.message : 'Backend non raggiungibile'}
        />
      </WidgetCard>
    )
  }
  if (!data) return <WidgetSkeleton title="Esercizi" />
  if (!data.length) return null

  return (
    <section aria-label="Esercizi più allenati">
      <WidgetCard title="Esercizi" meta="i più allenati">
        <ul aria-label="Esercizi più allenati" className="m-0 grid list-none grid-cols-6 gap-3 p-0">
          {data.map((e) => (
            <Card key={e.key} exercise={e} />
          ))}
        </ul>
      </WidgetCard>
    </section>
  )
}

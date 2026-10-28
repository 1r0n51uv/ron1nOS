import { Link } from 'react-router'

import { AlertRow, WidgetCard } from '@/components/ron1n'
import { WidgetSkeleton } from '@/components/WidgetSkeleton'
import { ApiError } from '@/lib/api'
import { num } from '@/lib/format'
import type { WorkoutSummary } from './data'
import { useWorkoutSummary } from './data'
import { duration, workoutDay } from './format'
import { ChooseImageDialog } from './images/ChooseImageDialog'
import { ExercisePhoto } from './images/ExercisePhoto'
import { WeekBars } from './WeekBars'

const ACTION = { label: 'Dettagli', to: '/allenamenti' }

// La foto dell'ultimo allenamento: l'immagine del primo esercizio, con
// sopra routine, giorno e durata. Senza immagine il riquadro apre Scegli
// immagine (GYM-014).
function LastWorkout({ last, today }: { last: NonNullable<WorkoutSummary['last']>; today: string }) {
  const exercise = last.exercise
  const when = [workoutDay(last.day, today), last.durationSeconds ? duration(last.durationSeconds) : null]
    .filter(Boolean)
    .join(' · ')
  const photo = (
    <ExercisePhoto
      name={exercise?.name ?? last.routine}
      image={exercise?.image ?? null}
      className="h-[140px]"
    >
      <div className="text-lg leading-6 font-semibold text-white">{last.routine || 'Allenamento'}</div>
      <div className="font-mono text-[13px] text-white/75">{when}</div>
    </ExercisePhoto>
  )
  if (!exercise || exercise.image) return photo
  return (
    <ChooseImageDialog name={exercise.name} current={null}>
      <button
        type="button"
        aria-label={`Scegli immagine per ${exercise.name}`}
        className="block w-full cursor-pointer border-0 bg-transparent p-0 text-left"
      >
        {photo}
      </button>
    </ChooseImageDialog>
  )
}

// Widget della dashboard (GYM-001): l'ultimo allenamento e la settimana.
export function WorkoutWidget({ className }: { className?: string }) {
  const { data, error } = useWorkoutSummary()

  if (!data && error) {
    return (
      <WidgetCard title="Allenamento" action={ACTION} className={className}>
        <AlertRow
          title="Allenamenti non disponibili."
          body={error instanceof ApiError ? error.message : 'Backend non raggiungibile'}
        />
      </WidgetCard>
    )
  }
  if (!data) return <WidgetSkeleton title="Allenamento" className={className} />

  if (!data.last) {
    return (
      <WidgetCard title="Allenamento" action={ACTION} className={className}>
        <div className="text-sm text-ink-muted">
          Nessun allenamento ·{' '}
          <Link
            to="/allenamenti"
            className="hit-area text-ink underline decoration-ink/40 underline-offset-4 hover:decoration-ink"
          >
            importa il CSV di Liftin’
          </Link>
        </div>
      </WidgetCard>
    )
  }

  return (
    <WidgetCard title="Allenamento" action={ACTION} className={className}>
      <LastWorkout last={data.last} today={data.today} />
      <div className="flex items-end gap-5">
        <div>
          <div className="font-mono text-[26px] leading-[30px] font-semibold">{num(data.thisWeek)}</div>
          <div className="text-xs text-ink-muted">questa settimana</div>
        </div>
        <div>
          <div className="font-mono text-[26px] leading-[30px] font-semibold">{num(data.streakDays)}</div>
          <div className="text-xs text-ink-muted">giorni di fila</div>
        </div>
        <WeekBars weeks={data.weeks.slice(-12)} height={44} className="ml-auto w-[45%]" />
      </div>
    </WidgetCard>
  )
}

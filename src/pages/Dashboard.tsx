import { StatusPill } from '@/components/ron1n'
import { useNow } from '@/hooks/useNow'
import { eyebrowDate, greeting, time } from '@/lib/format'
import { summarize, useContainers } from '@/modules/containers/data'
import { ContainersWidget } from '@/modules/containers/Widget'
import { DownloadsWidget } from '@/modules/downloads/Widget'
import { HomeWidget } from '@/modules/home/Widget'
import { NotesWidget } from '@/modules/notes/Widget'
import { nextMeal, useNutrition } from '@/modules/nutrition/data'
import { NutritionWidget } from '@/modules/nutrition/Widget'
import { ServerWidget } from '@/modules/server/Widget'
import { WeightWidget } from '@/modules/weight/Widget'
import { isFinished, useWorkout } from '@/modules/workout/data'
import { WorkoutWidget } from '@/modules/workout/Widget'

// Frase di stato sotto il saluto: cosa non funziona, cosa resta da fare.
function useSummary() {
  const containers = useContainers().data
  const nutrition = useNutrition().data
  const workout = useWorkout().data

  const parts: string[] = []
  if (containers) {
    const n = summarize(containers).down.length
    parts.push(
      n === 0
        ? 'Tutto operativo.'
        : n === 1
          ? 'Tutto operativo, tranne un container.'
          : `Tutto operativo, tranne ${n} container.`,
    )
  }

  const todo: string[] = []
  const meal = nutrition && nextMeal(nutrition)
  if (meal)
    todo.push(
      `la ${meal.name.toLowerCase()}`.replace('la pranzo', 'il pranzo').replace('la spuntino', 'lo spuntino'),
    )
  if (workout && !isFinished(workout)) {
    const ratio = workout.current / workout.exercises.length
    todo.push(ratio === 0 ? "l'allenamento" : ratio < 0.75 ? 'metà allenamento' : "la fine dell'allenamento")
  }
  if (todo.length) parts.push(`Ti manca ${todo.join(' e ')}.`)

  return parts.join(' ')
}

export function Dashboard() {
  const now = useNow()
  const summary = useSummary()
  const containers = useContainers().data
  const status = containers && summarize(containers)

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="font-mono text-xs tracking-[0.2em] text-ink-muted">
            {eyebrowDate(now)} · {time(now)}
          </div>
          <h1 className="mt-1.5 mb-0 font-display text-[44px] leading-[48px] font-bold">{greeting(now)}</h1>
          <p className="mt-1.5 mb-0 min-h-6 text-base leading-6 text-ink-muted">{summary}</p>
        </div>
        {status ? (
          <StatusPill tone={status.down.length ? 'alert' : 'ok'}>
            homelab · {status.running}/{status.total} attivi
          </StatusPill>
        ) : null}
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-5">
        <NutritionWidget />
        <WorkoutWidget />
        <WeightWidget />
        <HomeWidget />
        <ServerWidget />
        <ContainersWidget />
        <DownloadsWidget />
        <NotesWidget />
      </div>
    </>
  )
}

import { StatusPill } from '@/components/ron1n'
import { useNow } from '@/hooks/useNow'
import { eyebrowDate, greeting, time } from '@/lib/format'
import { summarize, useContainers } from '@/modules/containers/data'
import type { SlotId } from '@/modules/nutrition/data'
import { useDay } from '@/modules/nutrition/data'
import { todayRome } from '@/modules/nutrition/dates'
import { isFinished, useWorkout } from '@/modules/workout/data'
import { readingOrder, useDashboardLayout } from '@/widgets/layout'
import { availableWidgets } from '@/widgets/registry'

const MEAL_ARTICLE: Record<SlotId, string> = {
  breakfast: 'la colazione',
  morning_snack: 'lo spuntino',
  lunch: 'il pranzo',
  afternoon_snack: 'la merenda',
  dinner: 'la cena',
}

// Frase di stato sotto il saluto: cosa non funziona, cosa resta da fare.
function useSummary(now: Date) {
  const containers = useContainers().data
  const nutrition = useDay(todayRome(now)).data
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
  if (nutrition?.nextSlot) todo.push(MEAL_ARTICLE[nutrition.nextSlot])
  if (workout && !isFinished(workout)) {
    const ratio = workout.current / workout.exercises.length
    todo.push(ratio === 0 ? "l'allenamento" : ratio < 0.75 ? 'metà allenamento' : "la fine dell'allenamento")
  }
  if (todo.length) parts.push(`Ti manca ${todo.join(' e ')}.`)

  return parts.join(' ')
}

// I widget del layout salvato, in ordine di lettura; finché il layout non
// arriva, quelli del catalogo nel loro ordine.
function useWidgets() {
  const { layout, stored, saveFailed, retry } = useDashboardLayout()
  const available = availableWidgets()
  const widgets = layout
    ? readingOrder(layout.items).flatMap((item) => available.filter((w) => w.id === item.id))
    : available
  return { widgets, stored, saveFailed, retry }
}

export function Dashboard() {
  const { widgets, stored, saveFailed, retry } = useWidgets()
  const now = useNow()
  const summary = useSummary(now)
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

      {!stored ? (
        <p role="status" className="m-0 text-sm text-ink-muted">
          Layout predefinito · senza database le modifiche non si salvano
        </p>
      ) : null}
      {saveFailed ? (
        <p role="alert" className="m-0 flex items-center gap-3 text-sm text-brand-text">
          Layout non salvato ·
          <button
            type="button"
            onClick={retry}
            className="cursor-pointer border-0 bg-transparent p-0 text-brand-text underline"
          >
            Riprova
          </button>
        </p>
      ) : null}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-5">
        {widgets.map(({ id, component: Widget }) => (
          <Widget key={id} />
        ))}
      </div>
    </>
  )
}

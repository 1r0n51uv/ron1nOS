import { num } from '@/lib/format'
import type { Day } from '../data'
import { CAFFEINE_STEP_MG, useAddCaffeine, useUndoCaffeine } from '../data'
import { TrackerCard } from './TrackerCard'

// Caffeina del giorno (NUT-013): il contatore più gli alimenti registrati.
// − annulla solo le voci del contatore, i pasti si correggono dal diario.
export function CaffeineCard({ day }: { day: Day }) {
  const add = useAddCaffeine()
  const undo = useUndoCaffeine()
  const { totalMg, mealsMg } = day.caffeine
  return (
    <TrackerCard
      title="Caffeina"
      unit="mg"
      value={totalMg}
      target={null}
      addLabel={`Aggiungi un espresso, ${CAFFEINE_STEP_MG} mg`}
      undoLabel="Annulla l’ultima caffeina"
      canUndo={totalMg - mealsMg > 0}
      busy={add.isPending || undo.isPending}
      failed={Boolean(add.error || undo.error)}
      onAdd={() => add.mutate(day.date)}
      onUndo={() => undo.mutate(day.date)}
    >
      + un espresso, {CAFFEINE_STEP_MG} mg · − toglie l’ultima voce
      {mealsMg > 0 ? ` · ${num(mealsMg)} mg dai pasti` : ''}
    </TrackerCard>
  )
}

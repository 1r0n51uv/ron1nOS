import type { Day } from '../data'
import { useAddWater, useUndoWater, WATER_STEP_ML } from '../data'
import { TrackerCard } from './TrackerCard'

// Acqua del giorno (NUT-012), sull'obiettivo in ml quando c'è.
export function WaterCard({ day }: { day: Day }) {
  const add = useAddWater()
  const undo = useUndoWater()
  return (
    <TrackerCard
      title="Acqua"
      unit="ml"
      value={day.waterMl}
      target={day.goal?.waterMl ?? null}
      addLabel={`Aggiungi ${WATER_STEP_ML} ml`}
      undoLabel="Annulla l’ultima acqua"
      canUndo={day.waterMl > 0}
      busy={add.isPending || undo.isPending}
      failed={Boolean(add.error || undo.error)}
      onAdd={() => add.mutate(day.date)}
      onUndo={() => undo.mutate(day.date)}
    >
      + aggiunge {WATER_STEP_ML} ml · − toglie l’ultima voce
    </TrackerCard>
  )
}

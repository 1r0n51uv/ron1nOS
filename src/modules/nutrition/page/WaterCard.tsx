import { Icon, WidgetCard } from '@/components/ron1n'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { num } from '@/lib/format'
import type { Day } from '../data'
import { useAddWater, useUndoWater, WATER_STEP_ML } from '../data'

// Acqua del giorno (NUT-012): + aggiunge 250 ml, − annulla l'ultima voce.
export function WaterCard({ day }: { day: Day }) {
  const add = useAddWater()
  const undo = useUndoWater()
  const busy = add.isPending || undo.isPending
  const target = day.goal?.waterMl ?? 0
  const value = target > 0 ? Math.min(100, Math.round((day.waterMl / target) * 100)) : 0
  const text = target ? `${num(day.waterMl)} di ${num(target)} ml` : `${num(day.waterMl)} ml`

  return (
    <section aria-label="Acqua">
      <WidgetCard title="Acqua" meta={target ? `obiettivo ${num(target)} ml` : 'senza obiettivo'}>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <Button
              variant="glass"
              size="icon"
              aria-label="Annulla l’ultima acqua"
              disabled={busy || day.waterMl === 0}
              onClick={() => undo.mutate(day.date)}
            >
              <Icon name="minus" size={18} />
            </Button>
            <div className="font-mono text-[28px] leading-8 font-semibold">
              {num(day.waterMl)} <span className="text-[15px] text-ink-muted">ml</span>
            </div>
            <Button
              variant="glass"
              size="icon"
              aria-label={`Aggiungi ${WATER_STEP_ML} ml`}
              disabled={busy}
              onClick={() => add.mutate(day.date)}
            >
              <Icon name="plus" size={18} />
            </Button>
          </div>
          {target ? <Progress value={value} aria-label={`Acqua ${text}`} /> : null}
          <p className="m-0 text-[12px] text-ink-muted">
            + aggiunge {WATER_STEP_ML} ml · − toglie l’ultima voce
          </p>
          {add.error || undo.error ? (
            <p role="alert" className="m-0 text-[13px] text-brand-text">
              Acqua non salvata. Riprova.
            </p>
          ) : null}
        </div>
      </WidgetCard>
    </section>
  )
}

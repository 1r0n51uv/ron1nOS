import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { ApiError } from '@/lib/api'
import type { SlotDay } from '../data'
import { SLOT_LABELS, useSetPlanStatus } from '../data'
import { AddMealDialog } from '../log/AddMealDialog'
import { plannedDrafts } from '../log/meal'

// I comandi del piano di uno slot (NUT-009): l'interruttore mangiato, Salta,
// Modifica finché non è mangiato; in uno slot vuoto, Pianifica.
export function PlanBar({ date, slot }: { date: string; slot: SlotDay }) {
  const label = SLOT_LABELS[slot.slot]
  const plan = slot.planned
  const status = useSetPlanStatus()
  const error =
    status.error instanceof ApiError
      ? status.error.message
      : status.error
        ? 'Backend non raggiungibile'
        : null
  const set = (s: 'planned' | 'eaten' | 'skipped') => plan && status.mutate({ id: plan.id, status: s })

  if (!plan) {
    if (slot.state !== 'empty') return null
    return (
      <div className="flex justify-end">
        <AddMealDialog mode="plan" date={date} slot={slot.slot}>
          <Button variant="ghost" size="sm" aria-label={`Pianifica ${label}`}>
            Pianifica
          </Button>
        </AddMealDialog>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-end gap-2">
        {plan.status === 'planned' ? (
          <>
            <AddMealDialog mode="plan" date={date} slot={slot.slot} items={plannedDrafts(plan.items)}>
              <Button variant="ghost" size="sm" aria-label={`Modifica ${label} pianificato`}>
                Modifica
              </Button>
            </AddMealDialog>
            <Button variant="ghost" size="sm" disabled={status.isPending} onClick={() => set('skipped')}>
              Salta
            </Button>
          </>
        ) : plan.status === 'skipped' ? (
          <Button variant="ghost" size="sm" disabled={status.isPending} onClick={() => set('planned')}>
            Ripristina
          </Button>
        ) : null}
        {plan.status !== 'skipped' ? (
          <label className="flex items-center gap-2 text-[13px] text-ink-muted">
            Mangiato
            <Switch
              aria-label={`${label} mangiato`}
              checked={plan.status === 'eaten'}
              disabled={status.isPending}
              onCheckedChange={(on) => set(on ? 'eaten' : 'planned')}
            />
          </label>
        ) : null}
      </div>
      {error ? <span className="text-right text-xs text-brand-text">{error}</span> : null}
    </div>
  )
}

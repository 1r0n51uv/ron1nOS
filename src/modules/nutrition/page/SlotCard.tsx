import { Icon } from '@/components/ron1n'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { num } from '@/lib/format'
import type { SlotDay } from '../data'
import { SLOT_LABELS } from '../data'
import { AddMealDialog } from '../log/AddMealDialog'
import { ItemRow } from './ItemRow'

const STATE_TAG: Record<SlotDay['state'], string | null> = {
  empty: null,
  planned: 'pianificato',
  eaten: 'mangiato',
  skipped: 'saltato',
}

// Uno slot del giorno nei suoi stati (NUT-002): vuoto, pianificato,
// mangiato o saltato.
export function SlotCard({ date, slot }: { date: string; slot: SlotDay }) {
  const label = SLOT_LABELS[slot.slot]
  const tag = STATE_TAG[slot.state]
  const planned = slot.state === 'planned' ? slot.planned : null
  const note = planned?.templateName
    ? `dal template ${planned.templateName}`
    : planned?.recipeName
      ? planned.recipeName
      : null

  return (
    <article aria-label={label} className="flex flex-col gap-2.5 rounded-panel px-6 py-5 glass-panel">
      <div className="flex items-center gap-3">
        <div className="flex flex-1 items-baseline gap-2.5">
          <h2 className="m-0 font-display text-xl font-semibold">{label}</h2>
          {slot.state === 'empty' ? (
            <span className="text-[13px] text-ink-muted">Niente registrato.</span>
          ) : note ? (
            <span className="font-mono text-[13px] text-ink-muted">{note}</span>
          ) : null}
        </div>
        {tag ? <Badge>{tag}</Badge> : null}
        {slot.meal ? (
          <span className="font-mono text-[15px]">{num(slot.meal.kcal)} kcal</span>
        ) : planned ? (
          <span className="font-mono text-[15px] text-ink-muted">{num(planned.kcal)} kcal</span>
        ) : null}
        <AddMealDialog date={date} slot={slot.slot}>
          <Button variant="glass" size="icon" className="size-9" aria-label={`Registra in ${label}`}>
            <Icon name="plus" size={16} />
          </Button>
        </AddMealDialog>
      </div>

      {slot.meal ? (
        <ul className="m-0 flex list-none flex-col p-0">
          {slot.meal.items.map((item) => (
            <ItemRow key={item.id} item={item} />
          ))}
        </ul>
      ) : planned ? (
        <ul className="m-0 flex list-none flex-col p-0 text-ink-muted">
          {planned.items.map((item, i) => (
            <li key={`${item.name}-${i}`} className="flex min-h-10 items-center gap-3 text-sm">
              <span className="min-w-0 flex-1 truncate">{item.name}</span>
              <span className="font-mono text-[13px]">{num(item.grams)} g</span>
              <span className="w-[72px] text-right font-mono text-[13px]">{num(item.kcal)} kcal</span>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  )
}

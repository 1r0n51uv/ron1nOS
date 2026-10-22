import { useState } from 'react'

import { Icon } from '@/components/ron1n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { num } from '@/lib/format'
import type { Food } from '../data'
import { defaultGrams, macroLine, macrosOf, parseGrams } from './meal'

// L'alimento scelto: grammi, kcal e macro in diretta, Aggiungi. Va montato
// con `key` sull'alimento, così la quantità riparte dalla porzione.
export function PickedFood({ food, onAdd }: { food: Food; onAdd: (grams: number) => void }) {
  const [grams, setGrams] = useState(() => String(defaultGrams(food)))
  const g = parseGrams(grams)
  const m = g ? macrosOf(food, g) : null

  return (
    <div
      aria-label="Alimento scelto"
      role="group"
      className="flex items-center gap-4 rounded-[18px] px-4 py-3 glass-chip"
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{food.name}</span>
        <span className="font-mono text-xs text-ink-muted">
          {m ? `${num(m.kcal)} kcal · ${macroLine(m)}` : '—'}
        </span>
      </div>
      <span className="relative w-28">
        <Input
          aria-label="Quantità in grammi"
          type="number"
          inputMode="decimal"
          min={0}
          value={grams}
          onChange={(e) => setGrams(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && g) {
              e.preventDefault()
              onAdd(g)
            }
          }}
          className="pr-8"
        />
        <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 font-mono text-xs text-ink-muted">
          g
        </span>
      </span>
      <Button type="button" size="sm" variant="glass" disabled={!g} onClick={() => g && onAdd(g)}>
        <Icon name="plus" size={16} />
        Aggiungi
      </Button>
    </div>
  )
}

import { useId, useState } from 'react'

import { AlertRow } from '@/components/ron1n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { CustomFoodInput, Food } from '../data'
import { FOOD_FIELDS, toFoodDraft, toFoodInput } from './draft'

// Modulo di un alimento personale (NUT-006): valori per 100 g.
export function FoodForm({
  food,
  submitLabel,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  food?: Partial<Food> | null
  submitLabel: string
  pending: boolean
  error: unknown
  onSubmit: (input: CustomFoodInput) => void
  onCancel?: () => void
}) {
  const id = useId()
  const [draft, setDraft] = useState(() => toFoodDraft(food))
  const input = toFoodInput(draft)
  const message = error instanceof ApiError ? error.message : error ? 'Backend non raggiungibile' : null

  return (
    <form
      aria-label="Alimento personale"
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (input) onSubmit(input)
      }}
    >
      <div className="grid grid-cols-4 gap-3">
        {FOOD_FIELDS.map((f) => (
          <div
            key={f.key}
            className={cn(
              'flex flex-col gap-1.5 text-[13px] text-ink-muted',
              f.key === 'name' && 'col-span-4',
            )}
          >
            <label htmlFor={`${id}-${f.key}`}>
              {f.label}
              {f.required ? null : <span className="text-ink-muted/60"> · facoltativo</span>}
            </label>
            <span className="relative">
              <Input
                id={`${id}-${f.key}`}
                type={f.unit ? 'number' : 'text'}
                inputMode={f.key === 'barcode' ? 'numeric' : f.unit ? 'decimal' : undefined}
                min={f.unit ? 0 : undefined}
                step="any"
                value={draft[f.key]}
                onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                className={f.unit ? 'pr-14' : undefined}
                required={f.required}
              />
              {f.unit ? (
                <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 font-mono text-xs">
                  {f.unit}
                </span>
              ) : null}
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-ink-muted">Calorie e macro per 100 g.</span>
        <div className="flex gap-2">
          {onCancel ? (
            <Button type="button" variant="glass" size="sm" onClick={onCancel}>
              Annulla
            </Button>
          ) : null}
          <Button type="submit" size="sm" disabled={!input || pending}>
            {pending ? 'Salvo…' : submitLabel}
          </Button>
        </div>
      </div>
      {message ? <AlertRow title="Alimento non salvato." body={message} /> : null}
    </form>
  )
}

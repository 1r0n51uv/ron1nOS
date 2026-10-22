import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/api'
import { num } from '@/lib/format'
import type { MealItem } from '../data'
import { useRemoveItem, useSetGrams } from '../data'
import { parseGrams } from '../log/meal'

// Una riga di un pasto mangiato (NUT-007): i grammi si cambiano sul posto,
// la riga si toglie con ×.
export function ItemRow({ item }: { item: MealItem }) {
  const [editing, setEditing] = useState(false)
  const [grams, setGrams] = useState('')
  const save = useSetGrams()
  const remove = useRemoveItem()
  const g = parseGrams(grams)
  const failed = save.error ?? remove.error
  const error = failed instanceof ApiError ? failed.message : failed ? 'Backend non raggiungibile' : null

  function submit() {
    if (!g) return
    if (g === item.grams) return setEditing(false)
    save.mutate({ id: item.id, grams: g }, { onSuccess: () => setEditing(false) })
  }

  return (
    <li className="flex flex-col">
      <div className="flex min-h-10 items-center gap-3 text-sm">
        <span className="min-w-0 flex-1 truncate">{item.name}</span>
        {editing ? (
          <span className="relative w-24">
            <Input
              aria-label={`Grammi di ${item.name}`}
              type="number"
              inputMode="decimal"
              min={0}
              value={grams}
              autoFocus
              onChange={(e) => setGrams(e.target.value)}
              onBlur={() => !save.isPending && setEditing(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit()
                if (e.key === 'Escape') {
                  e.stopPropagation()
                  setEditing(false)
                }
              }}
              className="min-h-8 pr-7 text-[13px]"
            />
            <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 font-mono text-xs text-ink-muted">
              g
            </span>
          </span>
        ) : (
          <button
            type="button"
            aria-label={`Cambia i grammi di ${item.name}`}
            onClick={() => {
              setGrams(String(item.grams))
              save.reset()
              setEditing(true)
            }}
            className="cursor-pointer rounded-full px-2 font-mono text-[13px] text-ink-muted hover:bg-glass-hover"
          >
            {num(item.grams)} g
          </button>
        )}
        <span className="w-[72px] text-right font-mono text-[13px]">{num(item.kcal)} kcal</span>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={`Togli ${item.name}`}
          disabled={remove.isPending}
          onClick={() => remove.mutate(item.id)}
        >
          ×
        </Button>
      </div>
      {error ? <span className="text-xs text-brand-text">{error}</span> : null}
    </li>
  )
}

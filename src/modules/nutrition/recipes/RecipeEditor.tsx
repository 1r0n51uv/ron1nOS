import { useId, useState } from 'react'

import { AlertRow, WidgetCard } from '@/components/ron1n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/api'
import { num } from '@/lib/format'
import type { Food, Recipe } from '../data'
import { useSaveRecipe } from '../data'
import { FoodSearch } from '../log/FoodSearch'
import { macroLine } from '../log/meal'
import { PickedFood } from '../log/PickedFood'
import type { EditorRow } from './editor'
import { rowFromFood, rowMacros, rowsFromRecipe, rowsTotal, toRecipeInput } from './editor'

// Crea o modifica una ricetta (NUT-008): nome, note facoltative, alimenti
// con grammi e totali in diretta.
export function RecipeEditor({
  recipe,
  onSaved,
  onCancel,
}: {
  recipe?: Recipe
  onSaved: (recipe: Recipe) => void
  onCancel: () => void
}) {
  const id = useId()
  const [name, setName] = useState(recipe?.name ?? '')
  const [notes, setNotes] = useState(recipe?.notes ?? '')
  const [rows, setRows] = useState<EditorRow[]>(() => (recipe ? rowsFromRecipe(recipe) : []))
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Food | null>(null)
  const save = useSaveRecipe()
  const input = toRecipeInput(name, notes, rows)
  const total = rowsTotal(rows)
  const error =
    save.error instanceof ApiError ? save.error.message : save.error ? 'Backend non raggiungibile' : null
  const lost = recipe ? recipe.items.length - rows.length : 0

  return (
    <WidgetCard title={recipe ? 'Modifica ricetta' : 'Nuova ricetta'}>
      <div className="flex flex-col gap-4">
        <form
          id={`${id}-form`}
          aria-label="Ricetta"
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (input) save.mutate({ id: recipe?.id, input }, { onSuccess: (r) => onSaved(r as Recipe) })
          }}
        >
          <div className="flex flex-col gap-1.5 text-[13px] text-ink-muted">
            <label htmlFor={`${id}-name`}>Nome</label>
            <Input id={`${id}-name`} value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-1.5 text-[13px] text-ink-muted">
            <label htmlFor={`${id}-notes`}>
              Note <span className="text-ink-muted/60">· facoltative</span>
            </label>
            <textarea
              id={`${id}-notes`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-[14px] border border-glass-border bg-glass-strong px-3.5 py-2.5 text-[15px] text-ink outline-none focus-visible:border-brand-line"
            />
          </div>
        </form>

        <div className="flex flex-col gap-1">
          <div className="eyebrow">Alimenti</div>
          {rows.length ? (
            <ul aria-label="Alimenti della ricetta" className="m-0 flex list-none flex-col p-0">
              {rows.map((r) => (
                <li key={r.key} className="flex min-h-10 items-center gap-3 text-sm">
                  <span className="min-w-0 flex-1 truncate">{r.name}</span>
                  <span className="font-mono text-[13px] text-ink-muted">{num(r.grams)} g</span>
                  <span className="w-[72px] text-right font-mono text-[13px]">
                    {num(rowMacros(r).kcal)} kcal
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={`Togli ${r.name}`}
                    onClick={() => setRows(rows.filter((x) => x.key !== r.key))}
                  >
                    ×
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <span className="text-[13px] text-ink-muted">Nessun alimento. Cercali qui sotto.</span>
          )}
          {lost > 0 ? (
            <span className="text-xs text-ink-muted">
              {lost === 1
                ? 'Un alimento eliminato è stato tolto.'
                : `${lost} alimenti eliminati sono stati tolti.`}
            </span>
          ) : null}
        </div>

        <FoodSearch query={query} onQuery={setQuery} selected={selected} onPick={setSelected} />
        {selected ? (
          <PickedFood
            key={selected.id ?? `${selected.source}-${selected.externalId}`}
            food={selected}
            onAdd={(grams) => {
              setRows([...rows, rowFromFood(selected, grams)])
              setSelected(null)
            }}
          />
        ) : null}

        {error ? <AlertRow title="Ricetta non salvata." body={error} /> : null}

        <div className="flex items-center justify-between gap-3 border-t border-glass-border pt-3">
          <span className="font-mono text-[13px] text-ink-muted">
            {rows.length ? `${num(total.kcal)} kcal · ${macroLine(total)}` : '—'}
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="glass" size="sm" onClick={onCancel}>
              Annulla
            </Button>
            <Button type="submit" form={`${id}-form`} size="sm" disabled={!input || save.isPending}>
              {save.isPending ? 'Salvo…' : 'Salva'}
            </Button>
          </div>
        </div>
      </div>
    </WidgetCard>
  )
}

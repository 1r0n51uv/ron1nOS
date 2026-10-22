import { useState } from 'react'

import { AlertRow, Icon, WidgetCard } from '@/components/ron1n'
import { Button } from '@/components/ui/button'
import { useNow } from '@/hooks/useNow'
import { ApiError } from '@/lib/api'
import { num } from '@/lib/format'
import type { Recipe } from '../data'
import { useDay, useDeleteRecipe } from '../data'
import { todayRome } from '../dates'
import { AddMealDialog } from '../log/AddMealDialog'

const TILES = [
  { key: 'kcal', label: 'Kcal', unit: '' },
  { key: 'protein', label: 'Proteine', unit: ' g' },
  { key: 'carbs', label: 'Carbo', unit: ' g' },
  { key: 'fat', label: 'Grassi', unit: ' g' },
] as const

// Una ricetta: alimenti, totali, Registra oggi, Pianifica (NUT-009),
// Modifica, Elimina (NUT-008).
export function RecipeDetail({
  recipe,
  onEdit,
  onDeleted,
}: {
  recipe: Recipe
  onEdit: () => void
  onDeleted: () => void
}) {
  const today = todayRome(useNow())
  const slot = useDay(today).data?.suggestedSlot ?? 'lunch'
  const [confirm, setConfirm] = useState(false)
  const remove = useDeleteRecipe()
  const error =
    remove.error instanceof ApiError
      ? remove.error.message
      : remove.error
        ? 'Backend non raggiungibile'
        : null

  return (
    <WidgetCard title={recipe.name}>
      <div className="flex flex-col gap-4">
        {recipe.notes ? <p className="m-0 text-sm text-ink-muted">{recipe.notes}</p> : null}
        <ul aria-label="Alimenti" className="m-0 flex list-none flex-col p-0">
          {recipe.items.map((i) => (
            <li key={i.id} className="flex min-h-10 items-center gap-3 text-sm">
              <span className="min-w-0 flex-1 truncate">
                {i.name}
                {i.missing ? <span className="text-ink-muted"> · alimento eliminato</span> : null}
              </span>
              <span className="font-mono text-[13px] text-ink-muted">{num(i.grams)} g</span>
              <span className="w-[72px] text-right font-mono text-[13px]">{num(i.kcal)} kcal</span>
            </li>
          ))}
        </ul>
        <dl className="m-0 grid grid-cols-4 gap-3">
          {TILES.map((t) => (
            <div key={t.key} className="flex flex-col gap-1 rounded-[14px] px-3 py-2.5 glass-chip">
              <dt className="eyebrow">{t.label}</dt>
              <dd className="m-0 font-mono text-lg">
                {num(recipe[t.key])}
                {t.unit}
              </dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-wrap items-center gap-2">
          <AddMealDialog date={today} slot={slot} recipe={recipe}>
            <Button size="sm">
              <Icon name="plus" size={16} />
              Registra oggi
            </Button>
          </AddMealDialog>
          <AddMealDialog mode="plan" date={today} slot={slot} recipe={recipe}>
            <Button variant="glass" size="sm">
              Pianifica
            </Button>
          </AddMealDialog>
          <Button variant="glass" size="sm" onClick={onEdit}>
            Modifica
          </Button>
          {confirm ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => setConfirm(false)}>
                Tieni
              </Button>
              <Button
                variant="glass"
                size="sm"
                disabled={remove.isPending}
                onClick={() => remove.mutate(recipe.id, { onSuccess: onDeleted })}
              >
                Elimina davvero
              </Button>
            </>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setConfirm(true)}>
              Elimina
            </Button>
          )}
        </div>
        {error ? <AlertRow title="Ricetta non eliminata." body={error} /> : null}
      </div>
    </WidgetCard>
  )
}

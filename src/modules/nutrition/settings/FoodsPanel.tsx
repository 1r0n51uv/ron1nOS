import { useState } from 'react'

import { AlertRow, WidgetCard } from '@/components/ron1n'
import { WidgetSkeleton } from '@/components/WidgetSkeleton'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api'
import { num } from '@/lib/format'
import type { Food } from '../data'
import { useCreateFood, useCustomFoods, useDeleteFood, useUpdateFood } from '../data'
import { FoodForm } from '../foods/FoodForm'

// Alimenti personali in Impostazioni (NUT-006): si creano, si modificano e
// si eliminano. I pasti già registrati tengono i loro valori.
export function FoodsPanel() {
  const { data, error } = useCustomFoods()
  const [adding, setAdding] = useState(false)
  const create = useCreateFood()

  if (!data && error) {
    return (
      <WidgetCard title="Alimenti personali">
        <AlertRow
          title="Alimenti non disponibili."
          body={error instanceof ApiError ? error.message : 'Backend non raggiungibile'}
        />
      </WidgetCard>
    )
  }
  if (!data) return <WidgetSkeleton title="Alimenti personali" />

  return (
    <WidgetCard
      title="Alimenti personali"
      meta={`${data.foods.length} ${data.foods.length === 1 ? 'alimento' : 'alimenti'}`}
    >
      <div className="flex flex-col gap-3">
        {data.foods.length ? (
          <ul aria-label="Alimenti personali" className="m-0 flex list-none flex-col p-0">
            {data.foods.map((f) => (
              <FoodRow key={f.id} food={f} />
            ))}
          </ul>
        ) : (
          <span className="text-[13px] text-ink-muted">Nessun alimento personale.</span>
        )}
        {adding ? (
          <div className="border-t border-glass-border pt-3">
            <FoodForm
              submitLabel="Crea"
              pending={create.isPending}
              error={create.error}
              onCancel={() => setAdding(false)}
              onSubmit={(input) => create.mutate(input, { onSuccess: () => setAdding(false) })}
            />
          </div>
        ) : (
          <Button variant="glass" size="sm" className="self-start" onClick={() => setAdding(true)}>
            Nuovo alimento
          </Button>
        )}
      </div>
    </WidgetCard>
  )
}

function FoodRow({ food }: { food: Food }) {
  const [editing, setEditing] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const update = useUpdateFood()
  const remove = useDeleteFood()
  const removeError =
    remove.error instanceof ApiError
      ? remove.error.message
      : remove.error
        ? 'Backend non raggiungibile'
        : null

  if (editing) {
    return (
      <li className="border-b border-glass-border py-3">
        <FoodForm
          food={food}
          submitLabel="Salva"
          pending={update.isPending}
          error={update.error}
          onCancel={() => setEditing(false)}
          onSubmit={(input) => update.mutate({ id: food.id!, input }, { onSuccess: () => setEditing(false) })}
        />
      </li>
    )
  }

  return (
    <li aria-label={food.name} className="flex flex-col gap-1">
      <div className="flex min-h-11 items-center gap-3 text-sm">
        <span className="min-w-0 flex-1 truncate">
          {food.name}
          {food.brand ? <span className="text-ink-muted"> · {food.brand}</span> : null}
        </span>
        <span className="font-mono text-[13px] text-ink-muted">
          {num(food.kcal)} kcal · P {num(food.protein, 1)} · C {num(food.carbs, 1)} · G {num(food.fat, 1)}
        </span>
        <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
          Modifica
        </Button>
        {confirm ? (
          <>
            <Button variant="ghost" size="sm" onClick={() => setConfirm(false)}>
              Tieni
            </Button>
            <Button size="sm" disabled={remove.isPending} onClick={() => remove.mutate(food.id!)}>
              Elimina davvero
            </Button>
          </>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setConfirm(true)}>
            Elimina
          </Button>
        )}
      </div>
      {removeError ? <AlertRow title="Alimento non eliminato." body={removeError} /> : null}
    </li>
  )
}

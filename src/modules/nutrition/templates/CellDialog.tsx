import type { ReactNode } from 'react'
import { useState } from 'react'

import { AlertRow } from '@/components/ron1n'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ApiError } from '@/lib/api'
import type { Food, SlotId, Template, TemplateCell } from '../data'
import { SLOT_LABELS, useSaveTemplate } from '../data'
import { FoodSearch } from '../log/FoodSearch'
import { toFoodItem } from '../log/meal'
import { PickedFood } from '../log/PickedFood'
import { RecipeTab } from '../log/RecipeTab'
import { WEEKDAY_NAMES, withCell } from './cells'

// Una cella del template (NUT-010): una ricetta o un alimento, mai
// entrambi. Ogni scelta salva subito la griglia.
function CellEditor({
  template,
  weekday,
  slot,
  cell,
  onDone,
}: {
  template: Template
  weekday: number
  slot: SlotId
  cell?: TemplateCell
  onDone: () => void
}) {
  const [tab, setTab] = useState<'recipe' | 'food'>(cell && !cell.recipeId ? 'food' : 'recipe')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Food | null>(null)
  const save = useSaveTemplate()
  const error =
    save.error instanceof ApiError ? save.error.message : save.error ? 'Backend non raggiungibile' : null
  const at = { weekday, slot }
  const put = (next: Parameters<typeof withCell>[2]) =>
    save.mutate({ id: template.id, input: withCell(template, at, next) }, { onSuccess: onDone })

  return (
    <DialogContent className="max-w-[640px]">
      <DialogHeader>
        <div className="font-mono text-xs tracking-[0.2em] text-ink-muted">{template.name.toUpperCase()}</div>
        <DialogTitle>
          {WEEKDAY_NAMES[weekday - 1]} · {SLOT_LABELS[slot]}
        </DialogTitle>
        <DialogDescription className="text-[13px]">
          {cell ? `Ora: ${cell.name}` : 'Scegli una ricetta o un alimento.'}
        </DialogDescription>
      </DialogHeader>
      <Tabs value={tab} onValueChange={(v) => setTab(v as 'recipe' | 'food')}>
        <TabsList aria-label="Cosa mettere">
          <TabsTrigger value="recipe">Ricetta</TabsTrigger>
          <TabsTrigger value="food">Alimento</TabsTrigger>
        </TabsList>
        <TabsContent value="recipe">
          <RecipeTab onAdd={(r) => put({ ...at, recipeId: r.id })} />
        </TabsContent>
        <TabsContent value="food" className="flex flex-col gap-3">
          <FoodSearch query={query} onQuery={setQuery} selected={selected} onPick={setSelected} />
          {selected ? (
            <PickedFood
              key={selected.id ?? `${selected.source}-${selected.externalId}`}
              food={selected}
              onAdd={(grams) => put({ ...at, ...toFoodItem({ food: selected, grams }) })}
            />
          ) : null}
        </TabsContent>
      </Tabs>
      {error ? <AlertRow title="Template non salvato." body={error} /> : null}
      <DialogFooter>
        {cell ? (
          <Button variant="ghost" disabled={save.isPending} onClick={() => put(null)}>
            Svuota
          </Button>
        ) : (
          <span />
        )}
        <DialogClose asChild>
          <Button variant="glass">Chiudi</Button>
        </DialogClose>
      </DialogFooter>
    </DialogContent>
  )
}

export function CellDialog(props: {
  template: Template
  weekday: number
  slot: SlotId
  cell?: TemplateCell
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const { children, ...rest } = props
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      {open ? <CellEditor {...rest} onDone={() => setOpen(false)} /> : null}
    </Dialog>
  )
}

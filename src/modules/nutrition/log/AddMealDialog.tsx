import type { ReactNode } from 'react'
import { useCallback, useState } from 'react'

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
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ApiError } from '@/lib/api'
import { num } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Food, Recipe, SlotId } from '../data'
import { SLOT_LABELS, useCreateFood, useLogMeal, useSetPlan } from '../data'
import { eyebrowDay, isDay } from '../dates'
import { FoodForm } from '../foods/FoodForm'
import { BarcodeTab } from './BarcodeTab'
import { FoodSearch } from './FoodSearch'
import type { Draft } from './meal'
import { draftMacros, draftName, macroLine, toItem, totalOf } from './meal'
import { PickedFood } from './PickedFood'
import { RecipeTab } from './RecipeTab'

const SLOTS = Object.keys(SLOT_LABELS) as SlotId[]

type Tab = 'search' | 'barcode' | 'recipe' | 'new'
type Mode = 'log' | 'plan'

// Montato solo a modale aperto: chiudendo si riparte da capo.
function LogMeal({
  mode,
  initialDate,
  initialSlot,
  initialItems,
  onDone,
}: {
  mode: Mode
  initialDate: string
  initialSlot: SlotId
  initialItems: Draft[]
  onDone: () => void
}) {
  const plan = mode === 'plan'
  const [date, setDate] = useState(initialDate)
  const [slot, setSlot] = useState(initialSlot)
  const [tab, setTab] = useState<Tab>('search')
  // Il codice a barre sconosciuto passa al modulo Nuovo alimento.
  const [newBarcode, setNewBarcode] = useState<string | null>(null)
  const create = useCreateFood()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Food | null>(null)
  const [items, setItems] = useState<Draft[]>(initialItems)
  const logMeal = useLogMeal()
  const setPlan = useSetPlan()
  const log = plan ? setPlan : logMeal
  const total = totalOf(items)
  const error =
    log.error instanceof ApiError ? log.error.message : log.error ? 'Backend non raggiungibile' : null

  const pick = useCallback((food: Food) => setSelected(food), [])

  function add(draft: Draft) {
    setItems((list) => [...list, draft])
    setSelected(null)
  }

  function submit() {
    if (!isDay(date)) return
    log.mutate({ date, slot, items: items.map(toItem) }, { onSuccess: onDone })
  }

  return (
    <DialogContent className="max-w-[720px]">
      <DialogHeader>
        <div className="font-mono text-xs tracking-[0.2em] text-ink-muted">
          {plan ? 'PIANIFICA' : 'REGISTRA'} · {isDay(date) ? eyebrowDay(date) : '—'}
        </div>
        <DialogTitle>{plan ? 'Cosa vuoi mangiare' : 'Cosa hai mangiato'}</DialogTitle>
        <DialogDescription className="sr-only">
          {plan
            ? 'Scegli giorno, pasto e alimenti da pianificare.'
            : 'Cerca gli alimenti e aggiungili a un pasto.'}
        </DialogDescription>
      </DialogHeader>

      {plan ? (
        <label className="flex items-center gap-3 text-[13px] text-ink-muted">
          Giorno
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-44 font-mono"
            required
          />
        </label>
      ) : null}

      <div role="radiogroup" aria-label="Pasto" className="flex flex-wrap gap-2">
        {SLOTS.map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={slot === s}
            onClick={() => setSlot(s)}
            className={cn(
              'min-h-9 cursor-pointer rounded-full px-3.5 text-[13px] glass-chip',
              slot === s ? 'border-brand-line text-brand-text' : 'text-ink-muted hover:bg-glass-hover',
            )}
          >
            {SLOT_LABELS[s]}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList aria-label="Come aggiungere">
            <TabsTrigger value="search">Cerca</TabsTrigger>
            <TabsTrigger value="barcode">Codice a barre</TabsTrigger>
            <TabsTrigger value="recipe">Ricetta</TabsTrigger>
            <TabsTrigger value="new">Nuovo alimento</TabsTrigger>
          </TabsList>
          <TabsContent value="search">
            <FoodSearch query={query} onQuery={setQuery} selected={selected} onPick={pick} />
          </TabsContent>
          <TabsContent value="barcode">
            <BarcodeTab
              onPick={pick}
              onCreate={(code) => {
                setNewBarcode(code)
                setTab('new')
              }}
            />
          </TabsContent>
          <TabsContent value="recipe">
            <RecipeTab onAdd={(r) => add({ recipe: r, factor: 1 })} />
          </TabsContent>
          <TabsContent value="new">
            <FoodForm
              food={{ name: query.trim(), barcode: newBarcode }}
              submitLabel="Crea e scegli"
              pending={create.isPending}
              error={create.error}
              onSubmit={(input) =>
                create.mutate(input, {
                  onSuccess: (food) => {
                    pick(food)
                    setTab('search')
                  },
                })
              }
            />
          </TabsContent>
        </Tabs>
        {selected ? (
          <PickedFood
            key={selected.id ?? `${selected.source}-${selected.externalId}`}
            food={selected}
            onAdd={(grams) => add({ food: selected, grams })}
          />
        ) : null}
      </div>

      {items.length ? (
        <div className="flex flex-col gap-1 border-t border-glass-border pt-3">
          <div className="eyebrow">Nel pasto</div>
          <ul aria-label="Nel pasto" className="m-0 flex list-none flex-col p-0">
            {items.map((it, i) => (
              <li key={i} className="flex min-h-10 items-center gap-3 text-sm">
                <span className="min-w-0 flex-1 truncate">{draftName(it)}</span>
                <span className="font-mono text-[13px] text-ink-muted">
                  {'recipe' in it ? 'ricetta' : `${num(it.grams)} g`}
                </span>
                <span className="w-[72px] text-right font-mono text-[13px]">
                  {num(draftMacros(it).kcal)} kcal
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label={`Togli ${draftName(it)}`}
                  onClick={() => setItems(items.filter((_, j) => j !== i))}
                >
                  ×
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? (
        <AlertRow title={plan ? 'Pasto non pianificato.' : 'Pasto non registrato.'} body={error} />
      ) : null}

      <DialogFooter>
        <span className="font-mono text-[13px] text-ink-muted">
          {items.length ? `${num(total.kcal)} kcal · ${macroLine(total)}` : 'Nessun alimento'}
        </span>
        <div className="flex gap-2">
          <DialogClose asChild>
            <Button variant="glass">Annulla</Button>
          </DialogClose>
          <Button disabled={!items.length || !isDay(date) || log.isPending} onClick={submit}>
            {plan ? (log.isPending ? 'Pianifico…' : 'Pianifica') : log.isPending ? 'Registro…' : 'Registra'}
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  )
}

// Registrare (NUT-003) o pianificare (NUT-009) un pasto. Il trigger è il
// pulsante che lo apre: alla chiusura il focus torna lì. Con `recipe` la
// ricetta è già nel pasto, con `items` le righe di un piano da modificare.
export function AddMealDialog({
  mode = 'log',
  date,
  slot,
  recipe,
  items,
  children,
}: {
  mode?: Mode
  date: string
  slot: SlotId
  recipe?: Recipe
  items?: Draft[]
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      {open ? (
        <LogMeal
          mode={mode}
          initialDate={date}
          initialSlot={slot}
          initialItems={items ?? (recipe ? [{ recipe, factor: 1 }] : [])}
          onDone={() => setOpen(false)}
        />
      ) : null}
    </Dialog>
  )
}

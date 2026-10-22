import type { ReactNode } from 'react'
import { useEffect, useId, useState } from 'react'

import { AlertRow, Icon } from '@/components/ron1n'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import { ApiError } from '@/lib/api'
import { num } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Food, SlotId } from '../data'
import { SLOT_LABELS, useFoodSearch, useLogMeal } from '../data'
import { eyebrowDay } from '../dates'
import type { Draft } from './meal'
import { defaultGrams, macrosOf, parseGrams, SOURCE_NAME, SOURCE_TAG, toItem, totalOf } from './meal'

const SLOTS = Object.keys(SLOT_LABELS) as SlotId[]

function useDebounced<T>(value: T, ms = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return debounced
}

function macroLine(m: { protein: number; carbs: number; fat: number }) {
  return `P ${num(m.protein)} · C ${num(m.carbs)} · G ${num(m.fat)}`
}

// Montato solo a modale aperto: chiudendo si riparte da capo.
function LogMeal({ date, initialSlot, onDone }: { date: string; initialSlot: SlotId; onDone: () => void }) {
  const id = useId()
  const [slot, setSlot] = useState(initialSlot)
  const [query, setQuery] = useState('')
  const [italy, setItaly] = useState(true)
  const [selected, setSelected] = useState<Food | null>(null)
  const [grams, setGrams] = useState('')
  const [items, setItems] = useState<Draft[]>([])
  const q = useDebounced(query)
  const search = useFoodSearch(q, italy)
  const log = useLogMeal()
  const g = parseGrams(grams)
  const total = totalOf(items)
  const error =
    log.error instanceof ApiError ? log.error.message : log.error ? 'Backend non raggiungibile' : null

  function pick(food: Food) {
    setSelected(food)
    setGrams(String(defaultGrams(food)))
  }

  function add() {
    if (!selected || !g) return
    setItems([...items, { food: selected, grams: g }])
    setSelected(null)
    setGrams('')
  }

  function submit() {
    log.mutate({ date, slot, items: items.map(toItem) }, { onSuccess: onDone })
  }

  const results = q.trim().length >= 2 ? search.data?.results : undefined

  return (
    <DialogContent className="max-w-[720px]">
      <DialogHeader>
        <div className="font-mono text-xs tracking-[0.2em] text-ink-muted">REGISTRA · {eyebrowDay(date)}</div>
        <DialogTitle>Cosa hai mangiato</DialogTitle>
        <DialogDescription className="sr-only">Cerca gli alimenti e aggiungili a un pasto.</DialogDescription>
      </DialogHeader>

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
        <div className="flex items-center gap-4">
          <span className="relative flex-1">
            <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-muted">
              <Icon name="search" size={16} />
            </span>
            <Input
              aria-label="Cerca un alimento"
              placeholder="Cerca un alimento"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10"
              autoFocus
            />
          </span>
          <label htmlFor={`${id}-italy`} className="flex items-center gap-2 text-[13px] text-ink-muted">
            <Checkbox id={`${id}-italy`} checked={italy} onCheckedChange={(v) => setItaly(v === true)} />
            Solo Italia
          </label>
        </div>

        {results ? (
          results.length ? (
            <ul aria-label="Risultati" className="m-0 flex max-h-56 list-none flex-col overflow-y-auto p-0">
              {results.map((food, i) => (
                <li key={food.id ?? `${food.source}-${food.externalId ?? i}`}>
                  <button
                    type="button"
                    onClick={() => pick(food)}
                    aria-pressed={selected === food}
                    className={cn(
                      'flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-[12px] px-3 text-left text-sm hover:bg-glass-hover',
                      selected === food && 'bg-glass-strong',
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {food.name}
                      {food.brand ? <span className="text-ink-muted"> · {food.brand}</span> : null}
                    </span>
                    <Badge>{SOURCE_TAG[food.source]}</Badge>
                    <span className="w-[96px] text-right font-mono text-[13px] text-ink-muted">
                      {num(food.kcal)} kcal/100 g
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <span className="px-3 text-[13px] text-ink-muted">Nessun alimento trovato.</span>
          )
        ) : search.isFetching ? (
          <span className="px-3 text-[13px] text-ink-muted">Cerco…</span>
        ) : null}
        {search.data?.unavailable.length && results ? (
          <span className="px-3 text-xs text-ink-muted">
            Non risponde: {search.data.unavailable.map((s) => SOURCE_NAME[s]).join(' · ')}
          </span>
        ) : null}
        {search.error ? (
          <AlertRow
            title="Ricerca non disponibile."
            body={search.error instanceof ApiError ? search.error.message : 'Backend non raggiungibile'}
          />
        ) : null}

        {selected ? (
          <div
            aria-label="Alimento scelto"
            role="group"
            className="flex items-center gap-4 rounded-[18px] px-4 py-3 glass-chip"
          >
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium">{selected.name}</span>
              <span className="font-mono text-xs text-ink-muted">
                {g ? `${num(macrosOf(selected, g).kcal)} kcal · ${macroLine(macrosOf(selected, g))}` : '—'}
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
                  if (e.key === 'Enter') add()
                }}
                className="pr-8"
              />
              <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 font-mono text-xs text-ink-muted">
                g
              </span>
            </span>
            <Button size="sm" variant="glass" disabled={!g} onClick={add}>
              <Icon name="plus" size={16} />
              Aggiungi
            </Button>
          </div>
        ) : null}
      </div>

      {items.length ? (
        <div className="flex flex-col gap-1 border-t border-glass-border pt-3">
          <div className="eyebrow">Nel pasto</div>
          <ul aria-label="Nel pasto" className="m-0 flex list-none flex-col p-0">
            {items.map((it, i) => (
              <li key={i} className="flex min-h-10 items-center gap-3 text-sm">
                <span className="min-w-0 flex-1 truncate">{it.food.name}</span>
                <span className="font-mono text-[13px] text-ink-muted">{num(it.grams)} g</span>
                <span className="w-[72px] text-right font-mono text-[13px]">
                  {num(macrosOf(it.food, it.grams).kcal)} kcal
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label={`Togli ${it.food.name}`}
                  onClick={() => setItems(items.filter((_, j) => j !== i))}
                >
                  ×
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? <AlertRow title="Pasto non registrato." body={error} /> : null}

      <DialogFooter>
        <span className="font-mono text-[13px] text-ink-muted">
          {items.length ? `${num(total.kcal)} kcal · ${macroLine(total)}` : 'Nessun alimento'}
        </span>
        <div className="flex gap-2">
          <DialogClose asChild>
            <Button variant="glass">Annulla</Button>
          </DialogClose>
          <Button disabled={!items.length || log.isPending} onClick={submit}>
            {log.isPending ? 'Registro…' : 'Registra'}
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  )
}

// Registrare un pasto (NUT-003). Il trigger è il pulsante che lo apre:
// alla chiusura il focus torna lì.
export function AddMealDialog({ date, slot, children }: { date: string; slot: SlotId; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      {open ? <LogMeal date={date} initialSlot={slot} onDone={() => setOpen(false)} /> : null}
    </Dialog>
  )
}

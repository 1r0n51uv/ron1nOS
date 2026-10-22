import { useId, useState } from 'react'

import { AlertRow, WidgetCard } from '@/components/ron1n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/api'
import { num, shortDay } from '@/lib/format'
import { useDebounced } from '@/lib/useDebounced'
import { cn } from '@/lib/utils'
import type { Unmatched } from '../data'
import { SLOT_LABELS, useSetEquivalent, useUnmatched, useYazioProducts } from '../data'
import { addDays, todayRome } from '../dates'
import { SOURCE_NAME } from '../log/meal'

const errorText = (error: unknown) =>
  error instanceof ApiError ? error.message : error ? 'Backend non raggiungibile' : null

function dayWord(day: string) {
  const today = todayRome()
  if (day === today) return 'oggi'
  if (day === addDays(today, -1)) return 'ieri'
  return `il ${shortDay(day)}`
}

// Alimenti senza equivalente YAZIO (NUT-023): restano nel diario di
// ron1nOS; abbinati a mano, partono verso YAZIO. Si vede solo se ce ne sono.
export function UnmatchedPanel() {
  const { data } = useUnmatched()
  if (!data?.foods.length) return null
  return (
    <section aria-label="Senza equivalente">
      <WidgetCard title="Senza equivalente" meta={`${data.foods.length} da abbinare`}>
        <div className="flex flex-col gap-4">
          <p className="m-0 text-[13px] text-ink-muted">
            Alimenti che non hanno un prodotto YAZIO. Restano nel diario di ron1nOS; abbinati, partono verso
            YAZIO.
          </p>
          <ul className="m-0 flex list-none flex-col gap-4 p-0">
            {data.foods.map((u) => (
              <UnmatchedRow key={u.food.id} item={u} />
            ))}
          </ul>
          <span className="text-xs text-ink-muted">
            L’abbinamento si salva sull’alimento: la prossima volta parte da solo.
          </span>
        </div>
      </WidgetCard>
    </section>
  )
}

function UnmatchedRow({ item: { food, last } }: { item: Unmatched }) {
  const id = useId()
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState(food.name)
  const [chosen, setChosen] = useState<string | null>(null)
  const debounced = useDebounced(query)
  const products = useYazioProducts(searching ? debounced : '')
  const match = useSetEquivalent()
  const picked = products.data?.products.find((p) => p.yazioProductId === chosen)
  const source = food.source === 'custom' ? 'personale' : SOURCE_NAME[food.source]
  const message = errorText(match.error ?? products.error)

  return (
    <li aria-label={food.name} className="flex flex-col gap-3 border-t border-glass-border pt-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">
            {food.name}
            {food.brand ? <span className="font-normal text-ink-muted"> · {food.brand}</span> : null}
          </div>
          <div className="font-mono text-xs text-ink-muted">
            {source} · {num(food.kcal)} kcal / 100 g · usato {dayWord(last.day)} a {SLOT_LABELS[last.slot]},{' '}
            {num(last.grams)} g
          </div>
        </div>
        {searching ? null : (
          <Button variant="glass" size="sm" onClick={() => setSearching(true)}>
            Cerca in YAZIO
          </Button>
        )}
      </div>
      {searching ? (
        <div className="flex flex-col gap-2">
          <label htmlFor={`${id}-q`} className="sr-only">
            Cerca in YAZIO
          </label>
          <Input
            id={`${id}-q`}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setChosen(null)
            }}
          />
          {products.data ? (
            products.data.products.length ? (
              <div role="radiogroup" aria-label="Prodotti YAZIO" className="flex flex-col">
                {products.data.products.map((p) => (
                  <button
                    key={p.yazioProductId}
                    type="button"
                    role="radio"
                    aria-checked={chosen === p.yazioProductId}
                    onClick={() => setChosen(p.yazioProductId)}
                    className={cn(
                      'flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-xl border border-transparent bg-transparent px-3 text-left font-sans text-sm text-ink hover:bg-glass',
                      chosen === p.yazioProductId && 'border-brand-line bg-glass-strong',
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {p.name}
                      {p.brand ? <span className="text-ink-muted"> · {p.brand}</span> : null}
                    </span>
                    <span className="font-mono text-[13px] text-ink-muted">{num(p.kcal)} kcal / 100 g</span>
                  </button>
                ))}
              </div>
            ) : (
              <span className="text-[13px] text-ink-muted">Nessun prodotto YAZIO.</span>
            )
          ) : null}
          {picked ? (
            <span className="text-xs text-ink-muted">
              Differenza con l’alimento registrato:{' '}
              <span className="font-mono">
                {picked.kcal - food.kcal >= 0 ? '+' : '−'}
                {num(Math.abs(picked.kcal - food.kcal))} kcal / 100 g
              </span>
              .
            </span>
          ) : null}
        </div>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={match.isPending}
          onClick={() => match.mutate({ foodId: food.id, productId: null })}
        >
          Lascia solo in ron1nOS
        </Button>
        {searching ? (
          <Button
            size="sm"
            disabled={!chosen || match.isPending}
            onClick={() => chosen && match.mutate({ foodId: food.id, productId: chosen })}
          >
            Abbina e invia
          </Button>
        ) : null}
      </div>
      {message ? <AlertRow title="Abbinamento non riuscito." body={message} /> : null}
    </li>
  )
}

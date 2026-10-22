import { useId, useState } from 'react'

import { AlertRow, Icon } from '@/components/ron1n'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/api'
import { useDebounced } from '@/lib/useDebounced'
import { num } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Food } from '../data'
import { useFoodSearch } from '../data'
import { SOURCE_NAME, SOURCE_TAG } from './meal'

// Ricerca alimenti con Solo Italia (NUT-004): il testo lo tiene chi la usa,
// per passarlo a Nuovo alimento.
export function FoodSearch({
  query,
  onQuery,
  selected,
  onPick,
}: {
  query: string
  onQuery: (q: string) => void
  selected: Food | null
  onPick: (food: Food) => void
}) {
  const id = useId()
  const [italy, setItaly] = useState(true)
  const q = useDebounced(query)
  const search = useFoodSearch(q, italy)
  const results = q.trim().length >= 2 ? search.data?.results : undefined

  return (
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
            onChange={(e) => onQuery(e.target.value)}
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
                  onClick={() => onPick(food)}
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
    </div>
  )
}

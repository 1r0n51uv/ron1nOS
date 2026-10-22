import { useId, useState } from 'react'

import { AlertRow, WidgetCard } from '@/components/ron1n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useNow } from '@/hooks/useNow'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { Template } from '../data'
import { useApplyTemplate } from '../data'
import { addDays, isDay, mondayOf, todayRome, weekRange } from '../dates'

// Applica a una settimana (NUT-010): corrente, prossima o un lunedì scelto.
export function ApplyPanel({ template }: { template: Template }) {
  const id = useId()
  const thisWeek = mondayOf(todayRome(useNow()))
  const [choice, setChoice] = useState<'this' | 'next' | 'pick'>('next')
  const [picked, setPicked] = useState('')
  const apply = useApplyTemplate()
  const monday =
    choice === 'this'
      ? thisWeek
      : choice === 'next'
        ? addDays(thisWeek, 7)
        : isDay(picked)
          ? mondayOf(picked)
          : null
  const n = template.cells.length
  const error =
    apply.error instanceof ApiError ? apply.error.message : apply.error ? 'Backend non raggiungibile' : null
  const options = [
    { key: 'this', label: `Questa · ${weekRange(thisWeek)}` },
    { key: 'next', label: `Prossima · ${weekRange(addDays(thisWeek, 7))}` },
  ] as const

  return (
    <WidgetCard title="Applica a">
      <div className="flex flex-col gap-3">
        <div role="radiogroup" aria-label="Settimana" className="flex flex-wrap items-center gap-2">
          {options.map((o) => (
            <button
              key={o.key}
              type="button"
              role="radio"
              aria-checked={choice === o.key}
              onClick={() => setChoice(o.key)}
              className={cn(
                'min-h-9 cursor-pointer rounded-full px-3.5 font-mono text-[13px] glass-chip',
                choice === o.key
                  ? 'border-brand-line text-brand-text'
                  : 'text-ink-muted hover:bg-glass-hover',
              )}
            >
              {o.label}
            </button>
          ))}
          <button
            type="button"
            role="radio"
            aria-checked={choice === 'pick'}
            onClick={() => setChoice('pick')}
            className={cn(
              'min-h-9 cursor-pointer rounded-full px-3.5 text-[13px] glass-chip',
              choice === 'pick' ? 'border-brand-line text-brand-text' : 'text-ink-muted hover:bg-glass-hover',
            )}
          >
            Scegli lunedì…
          </button>
          {choice === 'pick' ? (
            <>
              <label htmlFor={`${id}-monday`} className="sr-only">
                Un giorno della settimana
              </label>
              <Input
                id={`${id}-monday`}
                type="date"
                value={picked}
                onChange={(e) => setPicked(e.target.value)}
                className="w-44 font-mono"
              />
            </>
          ) : null}
        </div>
        <p className="m-0 text-[13px] text-ink-muted">
          Crea {n} pasti pianificati{monday ? ` dal ${weekRange(monday)}` : ''}. Sostituisce solo quelli
          ancora pianificati; mangiati e saltati restano.
        </p>
        <div className="flex items-center justify-between gap-3">
          <span role="status" className="font-mono text-[13px] text-ink-muted">
            {apply.data
              ? `Creati ${apply.data.created} · sostituiti ${apply.data.replaced} · lasciati ${apply.data.kept}`
              : null}
          </span>
          <Button
            size="sm"
            disabled={!monday || !n || apply.isPending}
            onClick={() => monday && apply.mutate({ id: template.id, monday })}
          >
            {apply.isPending ? 'Applico…' : 'Applica'}
          </Button>
        </div>
        {error ? <AlertRow title="Template non applicato." body={error} /> : null}
      </div>
    </WidgetCard>
  )
}

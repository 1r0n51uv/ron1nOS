import { useId, useState } from 'react'

import { AlertRow, WidgetCard } from '@/components/ron1n'
import { WidgetSkeleton } from '@/components/WidgetSkeleton'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { useNow } from '@/hooks/useNow'
import { ApiError } from '@/lib/api'
import { num } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ShoppingItem } from '../data'
import {
  useAddShopping,
  useClearChecked,
  useDeleteShopping,
  useGenerateShopping,
  useShopping,
  useToggleShopping,
} from '../data'
import { addDays, mondayOf, todayRome, weekRange } from '../dates'

const message = (e: unknown) => (e instanceof ApiError ? e.message : e ? 'Backend non raggiungibile' : null)

function Row({ item }: { item: ShoppingItem }) {
  const id = useId()
  const toggle = useToggleShopping()
  const remove = useDeleteShopping()
  const qty = item.grams != null ? `${num(item.grams)} g` : item.text
  return (
    <li className="flex min-h-10 items-center gap-3 text-sm">
      <Checkbox
        id={id}
        checked={item.checked}
        onCheckedChange={(v) => toggle.mutate({ id: item.id, checked: v === true })}
      />
      <label
        htmlFor={id}
        className={cn('min-w-0 flex-1 truncate', item.checked && 'text-ink-muted line-through')}
      >
        {item.name}
      </label>
      {qty ? <span className="font-mono text-[13px] text-ink-muted">{qty}</span> : null}
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        aria-label={`Elimina ${item.name}`}
        disabled={remove.isPending}
        onClick={() => remove.mutate(item.id)}
      >
        ×
      </Button>
    </li>
  )
}

// Lista della spesa (NUT-011): generata dal piano di una settimana, più le
// voci a mano. Rigenerare aggiunge solo ciò che manca.
export function ShoppingPanel() {
  const thisWeek = mondayOf(todayRome(useNow()))
  const [week, setWeek] = useState(addDays(thisWeek, 7))
  const [name, setName] = useState('')
  const [text, setText] = useState('')
  const { data, error } = useShopping()
  const generate = useGenerateShopping()
  const add = useAddShopping()
  const clear = useClearChecked()
  const failed = message(generate.error ?? add.error ?? clear.error)

  if (!data && error) {
    return (
      <WidgetCard title="Lista della spesa">
        <AlertRow title="Lista non disponibile." body={message(error) ?? undefined} />
      </WidgetCard>
    )
  }
  if (!data) return <WidgetSkeleton title="Lista della spesa" />

  const generated = data.items.filter((i) => i.source === 'generated')
  const manual = data.items.filter((i) => i.source === 'manual')
  const checked = data.items.filter((i) => i.checked).length

  return (
    <WidgetCard title="Lista della spesa" meta={`${checked} di ${data.items.length}`}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-muted">
          <span>Dal piano di</span>
          <div role="radiogroup" aria-label="Settimana del piano" className="flex gap-2">
            {[thisWeek, addDays(thisWeek, 7)].map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={week === m}
                onClick={() => setWeek(m)}
                className={cn(
                  'min-h-9 cursor-pointer rounded-full px-3.5 font-mono text-[13px] glass-chip',
                  week === m ? 'border-brand-line text-brand-text' : 'text-ink-muted hover:bg-glass-hover',
                )}
              >
                {weekRange(m)}
              </button>
            ))}
          </div>
          <span>. Aggiunge solo ciò che manca.</span>
          <Button
            size="sm"
            variant="glass"
            className="ml-auto"
            disabled={generate.isPending}
            onClick={() => generate.mutate({ from: week, to: addDays(week, 6) })}
          >
            {generate.isPending ? 'Genero…' : 'Genera'}
          </Button>
        </div>
        {generate.data ? (
          <span role="status" className="text-xs text-ink-muted">
            {generate.data.added === 0
              ? 'Niente da aggiungere.'
              : generate.data.added === 1
                ? 'Aggiunta una voce.'
                : `Aggiunte ${generate.data.added} voci.`}
          </span>
        ) : null}

        {generated.length ? (
          <div className="flex flex-col gap-1">
            <div className="eyebrow">Dal piano</div>
            <ul aria-label="Dal piano" className="m-0 flex list-none flex-col p-0">
              {generated.map((i) => (
                <Row key={i.id} item={i} />
              ))}
            </ul>
          </div>
        ) : null}
        <div className="flex flex-col gap-1">
          <div className="eyebrow">Aggiunte a mano</div>
          {manual.length ? (
            <ul aria-label="Aggiunte a mano" className="m-0 flex list-none flex-col p-0">
              {manual.map((i) => (
                <Row key={i.id} item={i} />
              ))}
            </ul>
          ) : null}
          <form
            className="flex items-center gap-2 pt-1"
            onSubmit={(e) => {
              e.preventDefault()
              if (!name.trim()) return
              add.mutate(
                { name: name.trim(), text: text.trim() || null },
                {
                  onSuccess: () => {
                    setName('')
                    setText('')
                  },
                },
              )
            }}
          >
            <Input
              aria-label="Voce"
              placeholder="Aggiungi voce"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Input
              aria-label="Quantità"
              placeholder="Quantità"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-32"
            />
            <Button type="submit" size="sm" variant="glass" disabled={!name.trim() || add.isPending}>
              Aggiungi
            </Button>
          </form>
        </div>

        {failed ? <AlertRow title="Lista non aggiornata." body={failed} /> : null}

        <div className="flex justify-end border-t border-glass-border pt-3">
          <Button
            variant="ghost"
            size="sm"
            disabled={!checked || clear.isPending}
            onClick={() => clear.mutate()}
          >
            Togli le spuntate
          </Button>
        </div>
      </div>
    </WidgetCard>
  )
}

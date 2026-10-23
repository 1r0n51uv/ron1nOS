import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react'
import { useState } from 'react'

import { WidgetCard } from '@/components/ron1n'
import { Button } from '@/components/ui/button'
import { moveItem, NAV_MODULES, navPath, orderedRailItems, type NavItemId } from '@/layout/nav'
import { cn } from '@/lib/utils'
import { NAV_ITEMS } from '../../server/preferences/schema.ts'
import { usePreferences, useUpdatePreferences } from './data'

const sameOrder = (a: readonly string[], b: readonly string[]) => a.every((id, i) => id === b[i])

// Impostazioni › Navigazione (SET-006): l'ordine delle voci della barra,
// trascinando o con le frecce. Dashboard resta prima e Impostazioni ultima.
export function NavigationSection() {
  const prefs = usePreferences().data
  const update = useUpdatePreferences()
  const [dragged, setDragged] = useState<number | null>(null)
  if (!prefs) return null
  const order = prefs.navOrder
  const items = orderedRailItems(order)
  const labelOf = (id: NavItemId) => items.find((item) => item.to === navPath(id))?.label ?? id
  const save = (navOrder: NavItemId[]) => update.mutate({ navOrder })
  const move = (from: number, to: number) => {
    const next = moveItem(order, from, to)
    if (!sameOrder(next, order)) save(next)
  }

  return (
    <WidgetCard title="Ordine della barra">
      <p className="m-0 text-sm text-ink-muted">
        Trascina le voci o usa le frecce. Dashboard resta sempre prima, Impostazioni sempre ultima.
      </p>
      <ol aria-label="Voci della barra" className="m-0 flex list-none flex-col p-0">
        <FixedRow label={items[0].label} note="sempre prima" />
        {order.map((id, i) => {
          const label = labelOf(id)
          const off = prefs.disabledModules.includes(NAV_MODULES[navPath(id)])
          return (
            <li
              key={id}
              aria-label={label}
              draggable
              onDragStart={(e) => {
                setDragged(i)
                e.dataTransfer.effectAllowed = 'move'
              }}
              onDragOver={(e) => {
                if (dragged !== null) e.preventDefault()
              }}
              onDrop={(e) => {
                e.preventDefault()
                if (dragged !== null) move(dragged, i)
                setDragged(null)
              }}
              onDragEnd={() => setDragged(null)}
              className={cn(
                'flex cursor-grab items-center gap-3 border-t border-glass-border py-2',
                dragged === i && 'opacity-50',
              )}
            >
              <GripVertical aria-hidden className="size-4 text-ink-muted" />
              <span className="flex-1 text-sm">{label}</span>
              {off ? <span className="text-[13px] text-ink-muted">spento</span> : null}
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Sposta su · ${label}`}
                disabled={i === 0}
                onClick={() => move(i, i - 1)}
              >
                <ArrowUp />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Sposta giù · ${label}`}
                disabled={i === order.length - 1}
                onClick={() => move(i, i + 1)}
              >
                <ArrowDown />
              </Button>
            </li>
          )
        })}
        <FixedRow label={items.at(-1)!.label} note="sempre ultima" />
      </ol>
      {update.isError ? (
        <p role="alert" className="m-0 text-sm text-brand-text">
          Ordine non salvato · riprova
        </p>
      ) : null}
      <Button
        variant="glass"
        size="sm"
        className="self-start"
        disabled={sameOrder(order, NAV_ITEMS)}
        onClick={() => save([...NAV_ITEMS])}
      >
        Ripristina ordine
      </Button>
    </WidgetCard>
  )
}

function FixedRow({ label, note }: { label: string; note: string }) {
  return (
    <li
      aria-label={label}
      className="flex min-h-15 items-center gap-3 border-t border-glass-border py-2 first:border-t-0"
    >
      <span aria-hidden className="size-4" />
      <span className="flex-1 text-sm">{label}</span>
      <span className="text-[13px] text-ink-muted">{note}</span>
    </li>
  )
}

import type { CSSProperties, KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import { useEffect, useRef, useState } from 'react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { columnUnit, GAP_PX, GRID_COLUMNS, gridRows, moveBy, resizeBy, ROW_PX, rowUnit } from './grid'
import type { LayoutItem } from './layout'
import { readingOrder } from './layout'
import type { WidgetDef } from './types'
import { WidgetOptionsDialog } from './WidgetOptionsDialog'
import { resolveOptions } from '../../server/dashboard/catalog.ts'

type Placed = { item: LayoutItem; widget: WidgetDef }
type Gesture = 'move' | 'resize'

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
}

// La griglia libera della dashboard (DASH-003): ogni widget occupa il suo
// rettangolo x, y, w, h; gli spazi vuoti restano. Nel DOM i widget sono in
// ordine di lettura, così tastiera e lettori di schermo seguono lo schermo.
// Con `onChange` la griglia si modifica sempre (DASH-004): maniglia, angolo
// e menu compaiono al passaggio del mouse o con il fuoco.
export function DashboardGrid({
  items,
  widgets,
  onChange,
  onRemove,
}: {
  items: LayoutItem[]
  widgets: WidgetDef[]
  onChange?: (items: LayoutItem[]) => void
  onRemove?: (id: string) => void
}) {
  const grid = useRef<HTMLDivElement>(null)
  // Durante un trascinamento la griglia mostra la bozza; al rilascio la salva.
  const [draft, setDraft] = useState<{ id: string; items: LayoutItem[] } | null>(null)
  // Dopo uno spostamento da tastiera il widget cambia posto nel DOM: il
  // fuoco torna sulla sua maniglia.
  const refocus = useRef<string | null>(null)
  const [optionsId, setOptionsId] = useState<string | null>(null)
  const shown = draft?.items ?? items

  useEffect(() => {
    if (!refocus.current) return
    grid.current?.querySelector<HTMLElement>(`[data-widget="${refocus.current}"] [data-handle]`)?.focus()
    refocus.current = null
  })

  const placed: Placed[] = readingOrder(shown).flatMap((item) => {
    const widget = widgets.find((w) => w.id === item.id)
    return widget ? [{ item, widget }] : []
  })

  function startGesture(event: ReactPointerEvent, widget: WidgetDef, gesture: Gesture) {
    if (!onChange || event.button !== 0) return
    event.preventDefault()
    const start = { x: event.clientX, y: event.clientY }
    // Lo spazio vero tra le celle, che cambia con la densità (SET-003).
    const gap = grid.current ? parseFloat(getComputedStyle(grid.current).columnGap) || GAP_PX : GAP_PX
    const col = columnUnit(grid.current?.clientWidth ?? 0, gap)
    const row = rowUnit(gap)
    let latest = items
    const move = (e: PointerEvent) => {
      const dx = Math.round((e.clientX - start.x) / col)
      const dy = Math.round((e.clientY - start.y) / row)
      latest = gesture === 'move' ? moveBy(items, widget.id, dx, dy) : resizeBy(items, widget, dx, dy)
      setDraft({ id: widget.id, items: latest })
    }
    const end = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      setDraft(null)
      if (latest !== items) onChange(latest)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
  }

  function onHandleKey(event: KeyboardEvent, widget: WidgetDef) {
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      onRemove?.(widget.id)
      return
    }
    const arrow = ARROWS[event.key]
    if (!arrow || !onChange) return
    event.preventDefault()
    const [dx, dy] = arrow
    onChange(event.shiftKey ? resizeBy(items, widget, dx, dy) : moveBy(items, widget.id, dx, dy))
    refocus.current = widget.id
  }

  const options = placed.find((p) => p.widget.id === optionsId)

  const style: CSSProperties = {
    gridTemplateColumns: `repeat(${GRID_COLUMNS}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${gridRows(placed.map((p) => p.item))}, ${ROW_PX}px)`,
    gap: `var(--grid-gap, ${GAP_PX}px)`,
  }
  return (
    <div ref={grid} className="grid" style={style} data-testid="dashboard-grid">
      {placed.map(({ item, widget }) => (
        <div
          key={widget.id}
          data-widget={widget.id}
          data-dragging={draft?.id === widget.id || undefined}
          className={cn(
            'group/widget relative flex min-h-0 min-w-0 rounded-panel',
            onChange &&
              'outline-offset-4 focus-within:outline focus-within:outline-brand-line hover:outline hover:outline-brand-line data-[dragging]:outline data-[dragging]:outline-brand-line',
          )}
          style={{ gridColumn: `${item.x + 1} / span ${item.w}`, gridRow: `${item.y + 1} / span ${item.h}` }}
        >
          <widget.component
            className="min-h-0 flex-1 overflow-hidden"
            variant={item.variant ?? widget.variants[0]}
            options={resolveOptions(widget, item.options)}
          />
          {onChange ? (
            <WidgetControls
              widget={widget}
              onPointerDown={(e, gesture) => startGesture(e, widget, gesture)}
              onKeyDown={(e) => onHandleKey(e, widget)}
              onRemove={() => onRemove?.(widget.id)}
              onOptions={() => setOptionsId(widget.id)}
            />
          ) : null}
        </div>
      ))}
      {options && onChange ? (
        <WidgetOptionsDialog
          item={options.item}
          widget={options.widget}
          onChange={(next) => onChange(items.map((i) => (i.id === next.id ? next : i)))}
          onClose={() => setOptionsId(null)}
        />
      ) : null}
    </div>
  )
}

// Visibili al passaggio del mouse, con il fuoco dentro il widget o a menu aperto.
const reveal =
  'opacity-0 transition-opacity group-hover/widget:opacity-100 group-focus-within/widget:opacity-100 group-data-[dragging]/widget:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100'

function WidgetControls({
  widget,
  onPointerDown,
  onKeyDown,
  onRemove,
  onOptions,
}: {
  widget: WidgetDef
  onPointerDown: (event: ReactPointerEvent, gesture: Gesture) => void
  onKeyDown: (event: KeyboardEvent) => void
  onRemove: () => void
  onOptions: () => void
}) {
  return (
    <>
      <button
        type="button"
        data-handle
        aria-label={`Sposta il widget ${widget.title}`}
        aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Shift+ArrowRight Shift+ArrowDown Delete"
        title="Trascina per spostare · frecce per spostare, Maiusc + frecce per ridimensionare, Canc per rimuovere"
        onPointerDown={(e) => onPointerDown(e, 'move')}
        onKeyDown={onKeyDown}
        className={cn(
          'absolute -top-3.5 left-1/2 z-10 flex h-6 w-11 -translate-x-1/2 cursor-grab touch-none items-center justify-center rounded-full text-ink glass-chip active:cursor-grabbing',
          reveal,
        )}
      >
        <svg width="18" height="10" viewBox="0 0 18 10" aria-hidden="true">
          <g fill="currentColor">
            {[3, 9, 15].flatMap((cx) =>
              [2, 8].map((cy) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.5" />),
            )}
          </g>
        </svg>
      </button>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger
          aria-label={`Altre azioni sul widget ${widget.title}`}
          className={cn(
            'absolute -top-3.5 right-6 z-10 flex h-6 w-9 cursor-pointer items-center justify-center rounded-full text-ink glass-chip',
            reveal,
          )}
        >
          <svg width="16" height="4" viewBox="0 0 16 4" aria-hidden="true">
            <g fill="currentColor">
              <circle cx="2" cy="2" r="1.6" />
              <circle cx="8" cy="2" r="1.6" />
              <circle cx="14" cy="2" r="1.6" />
            </g>
          </svg>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onOptions}>Opzioni</DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={onRemove}>
            Rimuovi
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <button
        type="button"
        aria-label={`Ridimensiona il widget ${widget.title}`}
        tabIndex={-1}
        onPointerDown={(e) => onPointerDown(e, 'resize')}
        className={cn(
          'absolute -right-1.5 -bottom-1.5 z-10 size-[22px] cursor-nwse-resize touch-none border-0 bg-transparent p-0 text-brand-text',
          reveal,
        )}
      >
        <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
          <path d="M20 8v12H8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </>
  )
}

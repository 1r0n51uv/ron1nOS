// Regole della griglia libera (DASH-003): 24 colonne, righe da 24px. I
// widget stanno dove li si lascia, senza compattazione verso l'alto; se un
// widget finisce sopra un altro, l'altro scende quanto basta, e così a
// catena.
import { GRID_COLUMNS } from '../../server/dashboard/catalog.ts'
import type { LayoutItem } from './layout'
import type { WidgetDef } from './types'

export { GRID_COLUMNS }
export const ROW_PX = 24
export const GAP_PX = 16

type Rect = Pick<LayoutItem, 'x' | 'y' | 'w' | 'h'>

export function overlaps(a: Rect, b: Rect) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

// Mette `id` nel rettangolo `rect` (tenuto dentro le colonne) e spinge in
// basso i widget che ora gli stanno sotto. L'ordine degli elementi resta.
export function place(items: LayoutItem[], id: string, rect: Rect): LayoutItem[] {
  const w = Math.min(Math.max(rect.w, 1), GRID_COLUMNS)
  const x = Math.min(Math.max(rect.x, 0), GRID_COLUMNS - w)
  const moved = { x, y: Math.max(rect.y, 0), w, h: Math.max(rect.h, 1) }
  const next = items.map((i) => (i.id === id ? { ...i, ...moved } : { ...i }))
  const fixed = next.find((i) => i.id === id)
  if (!fixed) return items
  push(next, fixed)
  return next
}

// Chi tocca `by` scende sotto di lui; poi si controlla chi tocca quelli
// appena spostati. Si scende sempre, quindi il ciclo finisce.
function push(items: LayoutItem[], by: LayoutItem) {
  const queue = [by]
  while (queue.length) {
    const current = queue.shift() as LayoutItem
    for (const other of items) {
      if (other === current || other === by) continue
      if (overlaps(current, other)) {
        other.y = current.y + current.h
        queue.push(other)
      }
    }
  }
}

// Righe occupate dal widget più in basso: l'altezza della griglia.
export function gridRows(items: Rect[]) {
  return items.reduce((max, i) => Math.max(max, i.y + i.h), 0)
}

// Primo spazio libero dall'alto per un widget w×h (per `Aggiungi widget`).
export function firstFree(items: Rect[], w: number, h: number) {
  for (let y = 0; ; y++) {
    for (let x = 0; x + w <= GRID_COLUMNS; x++) {
      const rect = { x, y, w, h }
      if (!items.some((i) => overlaps(i, rect))) return rect
    }
  }
}

// Una cella della griglia in pixel, spazio compreso: serve a tradurre un
// trascinamento in colonne e righe.
export const ROW_UNIT_PX = ROW_PX + GAP_PX

export function columnUnit(gridWidth: number) {
  return (gridWidth - GAP_PX * (GRID_COLUMNS - 1)) / GRID_COLUMNS + GAP_PX
}

// Dimensioni tenute tra la minima e la massima del widget (DASH-001).
export function clampSize(size: WidgetDef['size'], w: number, h: number) {
  return {
    w: Math.min(Math.max(w, size.min.w), size.max.w),
    h: Math.min(Math.max(h, size.min.h), size.max.h),
  }
}

// Sposta di dx colonne e dy righe.
export function moveBy(items: LayoutItem[], id: string, dx: number, dy: number) {
  const item = items.find((i) => i.id === id)
  return item ? place(items, id, { ...item, x: item.x + dx, y: item.y + dy }) : items
}

// Allarga di dw colonne e dh righe, nei limiti del widget.
export function resizeBy(items: LayoutItem[], widget: WidgetDef, dw: number, dh: number) {
  const item = items.find((i) => i.id === widget.id)
  if (!item) return items
  const size = clampSize(widget.size, item.w + dw, item.h + dh)
  // Allargandosi non esce a destra: se c'è spazio resta dov'è.
  const w = Math.max(Math.min(size.w, GRID_COLUMNS - item.x), widget.size.min.w)
  return place(items, widget.id, { x: item.x, y: item.y, w, h: size.h })
}

// Aggiunge un widget nel primo spazio libero, alla dimensione predefinita.
export function addWidget(items: LayoutItem[], widget: WidgetDef): LayoutItem[] {
  const { w, h } = widget.size.default
  return [...items, { id: widget.id, ...firstFree(items, w, h) }]
}

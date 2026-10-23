// Regole della griglia libera (DASH-003): 24 colonne, righe da 24px. I
// widget stanno dove li si lascia, senza compattazione verso l'alto; se un
// widget finisce sopra un altro, l'altro scende quanto basta, e così a
// catena.
import { GRID_COLUMNS } from '../../server/dashboard/catalog.ts'
import type { LayoutItem } from './layout'

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

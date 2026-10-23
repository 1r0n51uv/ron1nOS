import type { CSSProperties } from 'react'

import { GAP_PX, GRID_COLUMNS, gridRows, ROW_PX } from './grid'
import type { LayoutItem } from './layout'
import { readingOrder } from './layout'
import type { WidgetDef } from './types'

type Placed = { item: LayoutItem; widget: WidgetDef }

// La griglia libera della dashboard (DASH-003): ogni widget occupa il suo
// rettangolo x, y, w, h; gli spazi vuoti restano. Nel DOM i widget sono in
// ordine di lettura, così tastiera e lettori di schermo seguono lo schermo.
export function DashboardGrid({ items, widgets }: { items: LayoutItem[]; widgets: WidgetDef[] }) {
  const placed: Placed[] = readingOrder(items).flatMap((item) => {
    const widget = widgets.find((w) => w.id === item.id)
    return widget ? [{ item, widget }] : []
  })
  const style: CSSProperties = {
    gridTemplateColumns: `repeat(${GRID_COLUMNS}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${gridRows(placed.map((p) => p.item))}, ${ROW_PX}px)`,
    gap: GAP_PX,
  }
  return (
    <div className="grid" style={style} data-testid="dashboard-grid">
      {placed.map(({ item, widget: { id, component: Widget } }) => (
        <div
          key={id}
          data-widget={id}
          className="flex min-h-0 min-w-0"
          style={{ gridColumn: `${item.x + 1} / span ${item.w}`, gridRow: `${item.y + 1} / span ${item.h}` }}
        >
          <Widget className="min-h-0 flex-1 overflow-hidden" />
        </div>
      ))}
    </div>
  )
}

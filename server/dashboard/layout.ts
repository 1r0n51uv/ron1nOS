// Layout della dashboard (DASH-007, DASH-008): quali widget, dove, quanto
// grandi e con quale variante. La forma la controlla zod, le regole (id
// noti, dimensioni nei limiti, niente sovrapposizioni) le controlla
// validateLayout contro il catalogo.
import { z } from 'zod'

import type { Queryable } from '../db.ts'
import { catalogEntry, GRID_COLUMNS, optionsError, WIDGET_CATALOG } from './catalog.ts'

export const DEVICES = ['desktop', 'iphone'] as const
export type Device = (typeof DEVICES)[number]

const Cell = z.number().int().min(0).max(1000)

export const LayoutItem = z.object({
  id: z.string().min(1).max(80),
  x: Cell,
  y: Cell,
  w: Cell,
  h: Cell,
  variant: z.enum(['compact', 'detailed']).optional(),
  options: z.record(z.string(), z.unknown()).optional(),
})

export const Layout = z.object({
  header: z.enum(['full', 'line', 'hidden']),
  items: z.array(LayoutItem).max(60),
})

export type LayoutItem = z.infer<typeof LayoutItem>
export type Layout = z.infer<typeof Layout>

// 422 invalid_layout: forma giusta, ma il layout non rispetta le regole.
export class InvalidLayoutError extends Error {}

export function validateLayout(layout: Layout) {
  const seen = new Set<string>()
  for (const item of layout.items) {
    const entry = catalogEntry(item.id)
    if (!entry) throw new InvalidLayoutError(`Widget sconosciuto: ${item.id}`)
    // Un widget per tipo (decisione 1): le copie non sono previste.
    if (seen.has(item.id)) throw new InvalidLayoutError(`Widget ripetuto: ${item.id}`)
    seen.add(item.id)
    const { min, max } = entry.size
    if (item.w < min.w || item.w > max.w || item.h < min.h || item.h > max.h) {
      throw new InvalidLayoutError(`Dimensione fuori dai limiti: ${item.id}`)
    }
    if (item.x + item.w > GRID_COLUMNS) throw new InvalidLayoutError(`Fuori dalla griglia: ${item.id}`)
    if (item.variant && !entry.variants.includes(item.variant)) {
      throw new InvalidLayoutError(`Variante non disponibile: ${item.id}`)
    }
    const problem = item.options && optionsError(entry, item.options)
    if (problem) throw new InvalidLayoutError(`Opzioni non valide: ${item.id}, ${problem}`)
  }
  const items = layout.items
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (overlaps(items[i], items[j])) {
        throw new InvalidLayoutError(`Widget sovrapposti: ${items[i].id}, ${items[j].id}`)
      }
    }
  }
  return layout
}

function overlaps(a: LayoutItem, b: LayoutItem) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

// Layout predefinito (DASH-008): la dashboard di oggi, widget del catalogo
// in fila alla loro dimensione predefinita. Sull'iPhone uno per riga.
export function defaultLayout(device: Device): Layout {
  const items: LayoutItem[] = []
  let x = 0
  let y = 0
  let rowHeight = 0
  for (const entry of WIDGET_CATALOG) {
    const w = device === 'iphone' ? entry.size.max.w : entry.size.default.w
    const { h } = entry.size.default
    if (x + w > GRID_COLUMNS || device === 'iphone') {
      if (x > 0) {
        y += rowHeight
        x = 0
        rowHeight = 0
      }
    }
    items.push({ id: entry.id, x, y, w, h })
    x += w
    rowHeight = Math.max(rowHeight, h)
  }
  return { header: 'full', items }
}

export type StoredLayout = Layout & { updatedAt: string | null }

export async function getLayout(db: Queryable, device: Device): Promise<StoredLayout> {
  const { rows } = await db.query<{ layout: Layout; updatedAt: Date }>(
    'select layout, updated_at as "updatedAt" from dashboard_layouts where device = $1',
    [device],
  )
  const row = rows[0]
  if (!row) return { ...defaultLayout(device), updatedAt: null }
  return { ...row.layout, updatedAt: row.updatedAt.toISOString() }
}

export async function putLayout(db: Queryable, device: Device, layout: Layout): Promise<StoredLayout> {
  const { rows } = await db.query<{ updatedAt: Date }>(
    `insert into dashboard_layouts (device, layout) values ($1, $2)
     on conflict (device) do update set layout = excluded.layout, updated_at = now()
     returning updated_at as "updatedAt"`,
    [device, JSON.stringify(layout)],
  )
  return { ...layout, updatedAt: rows[0].updatedAt.toISOString() }
}

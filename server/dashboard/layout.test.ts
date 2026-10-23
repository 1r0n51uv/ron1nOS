// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { WIDGET_CATALOG } from './catalog.ts'
import type { Layout } from './layout.ts'
import { defaultLayout, InvalidLayoutError, validateLayout } from './layout.ts'

const item = (id: string, x: number, y: number, w = 8, h = 8) => ({ id, x, y, w, h })
const layout = (...items: Layout['items']): Layout => ({ header: 'full', items })

describe('validazione del layout (DASH-007)', () => {
  it('accetta il layout predefinito di ogni dispositivo', () => {
    expect(() => validateLayout(defaultLayout('desktop'))).not.toThrow()
    expect(() => validateLayout(defaultLayout('iphone'))).not.toThrow()
  })

  it('rifiuta id sconosciuti e ripetuti', () => {
    expect(() => validateLayout(layout(item('server.nope', 0, 0)))).toThrow(InvalidLayoutError)
    expect(() => validateLayout(layout(item('server.summary', 0, 0), item('server.summary', 8, 0)))).toThrow(
      'Widget ripetuto',
    )
  })

  it('rifiuta dimensioni fuori dai limiti e widget oltre la griglia', () => {
    expect(() => validateLayout(layout(item('server.summary', 0, 0, 2, 8)))).toThrow('Dimensione')
    expect(() => validateLayout(layout(item('server.summary', 0, 0, 8, 40)))).toThrow('Dimensione')
    expect(() => validateLayout(layout(item('server.summary', 20, 0, 8, 8)))).toThrow('Fuori dalla griglia')
  })

  it('rifiuta sovrapposizioni ma accetta widget che si toccano e spazi vuoti', () => {
    expect(() => validateLayout(layout(item('server.summary', 0, 0), item('notes.summary', 4, 4)))).toThrow(
      'sovrapposti',
    )
    expect(() =>
      validateLayout(
        layout(item('server.summary', 0, 0), item('notes.summary', 8, 0), item('weight.summary', 0, 20)),
      ),
    ).not.toThrow()
  })

  it('rifiuta varianti e opzioni che il widget non dichiara', () => {
    expect(() => validateLayout(layout({ ...item('server.summary', 0, 0), variant: 'compact' }))).toThrow(
      'Variante',
    )
    expect(() =>
      validateLayout(layout({ ...item('server.summary', 0, 0), options: { metric: 'cpu' } })),
    ).toThrow('Opzioni')
    expect(() => validateLayout(layout({ ...item('server.summary', 0, 0), options: {} }))).not.toThrow()
  })

  it('accetta le opzioni dichiarate e rifiuta valori fuori dal catalogo (DASH-005)', () => {
    const downloads = (limit: unknown) => layout({ ...item('downloads.summary', 0, 0), options: { limit } })
    expect(() => validateLayout(downloads(5))).not.toThrow()
    expect(() => validateLayout(downloads(9))).toThrow('limit')
    const nutrition = (macros: unknown) =>
      layout({ ...item('nutrition.summary', 0, 0), w: 8, h: 10, options: { macros } })
    expect(() => validateLayout(nutrition(['fat']))).not.toThrow()
    expect(() => validateLayout(nutrition(['fat', 'fat']))).toThrow('macros')
    expect(() => validateLayout(nutrition('fat'))).toThrow('macros')
    expect(() =>
      validateLayout(layout({ ...item('weight.summary', 0, 0), variant: 'compact' })),
    ).not.toThrow()
  })
})

describe('layout predefinito (DASH-008)', () => {
  it('sul desktop mette tutti i widget del catalogo in ordine, tre per riga', () => {
    const { header, items } = defaultLayout('desktop')
    expect(header).toBe('full')
    expect(items.map((i) => i.id)).toEqual(WIDGET_CATALOG.map((w) => w.id))
    expect(items.slice(0, 3).map((i) => [i.x, i.y])).toEqual([
      [0, 0],
      [8, 0],
      [16, 0],
    ])
    expect(items[3].x).toBe(0)
    expect(items[3].y).toBeGreaterThan(0)
  })

  it('sull’iPhone mette un widget per riga', () => {
    const xs = defaultLayout('iphone').items.map((i) => i.x)
    expect(new Set(xs)).toEqual(new Set([0]))
  })
})

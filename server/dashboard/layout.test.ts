// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { WIDGET_CATALOG } from './catalog.ts'
import type { Layout } from './layout.ts'
import { defaultLayout, InvalidLayoutError, migrateIphone, validateLayout } from './layout.ts'

const item = (id: string, x: number, y: number, w = 8, h = 8) => ({ id, x, y, w, h })
const layout = (...items: Layout['items']): Layout => ({ header: 'full', items })

describe('validazione del layout (DASH-007)', () => {
  it('accetta il layout predefinito di ogni dispositivo', () => {
    expect(() => validateLayout(defaultLayout('desktop'))).not.toThrow()
    expect(() => validateLayout(defaultLayout('iphone'), 'iphone')).not.toThrow()
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
  it('sul desktop mette i summary del catalogo in ordine, tre per riga', () => {
    const { header, items } = defaultLayout('desktop')
    expect(header).toBe('full')
    expect(items.map((i) => i.id)).toEqual(
      WIDGET_CATALOG.filter((w) => w.id.endsWith('.summary')).map((w) => w.id),
    )
    expect(items.slice(0, 3).map((i) => [i.x, i.y])).toEqual([
      [0, 0],
      [8, 0],
      [16, 0],
    ])
    expect(items[3].x).toBe(0)
    expect(items[3].y).toBeGreaterThan(0)
  })

  it('sull’iPhone segue DASH-010, con i due piccoli affiancati', () => {
    expect(defaultLayout('iphone').items).toEqual([
      { id: 'nutrition.summary', x: 0, y: 0, w: 4, h: 4 },
      { id: 'workout.summary', x: 0, y: 4, w: 4, h: 2 },
      { id: 'server.metric', x: 0, y: 6, w: 2, h: 2 },
      { id: 'downloads.speed', x: 2, y: 6, w: 2, h: 2 },
      { id: 'documents.summary', x: 0, y: 8, w: 4, h: 2 },
    ])
  })
})

describe('griglia dell’iPhone (DASH-010)', () => {
  const phone = (...items: Layout['items']) => validateLayout(layout(...items), 'iphone')

  it('accetta le misure dichiarate dal widget sulla griglia di 4 colonne', () => {
    expect(() =>
      phone(
        item('server.metric', 0, 0, 2, 2),
        item('downloads.speed', 2, 0, 2, 2),
        item('server.summary', 0, 2, 4, 4),
      ),
    ).not.toThrow()
  })

  it('rifiuta misure non ammesse, widget senza misure iPhone e posizioni fuori dalle colonne', () => {
    expect(() => phone(item('server.metric', 0, 0, 4, 4))).toThrow('Misura non ammessa')
    expect(() => phone(item('server.summary', 0, 0, 3, 2))).toThrow('Misura non ammessa')
    expect(() => phone(item('weight.summary', 0, 0, 4, 2))).toThrow('non disponibile su iPhone')
    expect(() => phone(item('server.metric', 3, 0, 2, 2))).toThrow('Fuori dalla griglia')
  })

  it('rifiuta sovrapposizioni come sul desktop', () => {
    expect(() => phone(item('server.metric', 0, 0, 2, 2), item('downloads.speed', 0, 1, 4, 2))).toThrow(
      'sovrapposti',
    )
  })

  it('il layout del desktop resta sulla sua griglia', () => {
    expect(() => validateLayout(layout(item('server.summary', 0, 0, 4, 2)))).toThrow('Dimensione')
    expect(() => validateLayout(defaultLayout('desktop'))).not.toThrow()
  })

  it('converte un layout salvato prima di DASH-010: tutti medi, nell’ordine di prima', () => {
    const old = {
      header: 'line' as const,
      items: [
        { ...item('server.summary', 0, 11, 24, 11) },
        { ...item('nutrition.summary', 0, 0, 16, 10), options: { macros: ['fat'] } },
        { ...item('weight.summary', 0, 30, 16, 7), variant: 'compact' as const },
        { ...item('server.metric', 0, 40, 12, 4), variant: 'compact' as const },
      ],
    }
    expect(migrateIphone(old)).toEqual({
      header: 'line',
      items: [
        { id: 'nutrition.summary', x: 0, y: 0, w: 4, h: 2, options: { macros: ['fat'] } },
        { id: 'server.summary', x: 0, y: 2, w: 4, h: 2 },
        { id: 'server.metric', x: 0, y: 4, w: 4, h: 2, variant: 'compact' },
      ],
    })
    expect(() => validateLayout(migrateIphone(old), 'iphone')).not.toThrow()
  })

  it('lascia com’è un layout già valido per l’iPhone', () => {
    const current = defaultLayout('iphone')
    expect(migrateIphone(current)).toBe(current)
  })
})

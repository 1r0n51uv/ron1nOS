import { describe, expect, it } from 'vitest'

import {
  addWidget,
  clampSize,
  columnUnit,
  firstFree,
  gridRows,
  moveBy,
  overlaps,
  place,
  resizeBy,
} from './grid'
import type { WidgetDef } from './types'

const a = { id: 'a', x: 0, y: 0, w: 8, h: 8 }
const b = { id: 'b', x: 8, y: 0, w: 8, h: 8 }
const c = { id: 'c', x: 8, y: 8, w: 8, h: 4 }

describe('griglia libera (DASH-003)', () => {
  it('riconosce sovrapposizioni, non i widget che si toccano', () => {
    expect(overlaps(a, b)).toBe(false)
    expect(overlaps(a, { ...b, x: 7 })).toBe(true)
  })

  it('lascia il widget dove lo si mette, anche con spazi vuoti', () => {
    const items = place([a, b], 'a', { x: 0, y: 20, w: 8, h: 8 })
    expect(items).toEqual([{ ...a, y: 20 }, b])
  })

  it('spinge sotto chi viene coperto, e a catena', () => {
    const items = place([a, b, c], 'a', { x: 6, y: 2, w: 8, h: 8 })
    expect(items.find((i) => i.id === 'b')).toMatchObject({ y: 10 })
    expect(items.find((i) => i.id === 'c')).toMatchObject({ y: 18 })
    for (const i of items) for (const j of items) if (i !== j) expect(overlaps(i, j)).toBe(false)
  })

  it('tiene il widget dentro le 24 colonne', () => {
    expect(place([a], 'a', { x: 20, y: 0, w: 8, h: 8 })[0]).toMatchObject({ x: 16 })
    expect(place([a], 'a', { x: -3, y: -1, w: 8, h: 8 })[0]).toMatchObject({ x: 0, y: 0 })
  })

  it('calcola l’altezza e il primo spazio libero', () => {
    expect(gridRows([a, c])).toBe(12)
    expect(firstFree([a, b], 8, 8)).toEqual({ x: 16, y: 0, w: 8, h: 8 })
    expect(firstFree([a, b, { id: 'd', x: 16, y: 0, w: 8, h: 4 }], 8, 8)).toEqual({ x: 16, y: 4, w: 8, h: 8 })
  })
})

const widget = (id: string): WidgetDef => ({
  id,
  module: 'notes',
  title: id,
  description: '',
  size: { min: { w: 6, h: 4 }, default: { w: 8, h: 6 }, max: { w: 12, h: 10 } },
  variants: [],
  component: () => null,
})

describe('modifica della griglia (DASH-004)', () => {
  it('traduce i pixel in colonne con lo spazio compreso', () => {
    // 24 colonne da 24px più 23 spazi da 16px: 944px.
    expect(columnUnit(24 * 24 + 23 * 16)).toBe(40)
  })

  it('sposta di colonne e righe, spingendo chi viene coperto', () => {
    const items = moveBy([a, b], 'a', 4, 0)
    expect(items[0]).toMatchObject({ x: 4, y: 0 })
    expect(items[1]).toMatchObject({ x: 8, y: 8 })
    expect(moveBy([a], 'ignoto', 1, 1)).toEqual([a])
  })

  it('ridimensiona nei limiti del widget', () => {
    expect(clampSize(widget('a').size, 2, 30)).toEqual({ w: 6, h: 10 })
    expect(resizeBy([a], widget('a'), 10, -10)[0]).toMatchObject({ w: 12, h: 4 })
  })

  it('allargandosi non esce dalle 24 colonne e resta al suo posto', () => {
    const right = { id: 'a', x: 14, y: 0, w: 8, h: 6 }
    expect(resizeBy([right], widget('a'), 4, 0)[0]).toMatchObject({ x: 14, w: 10 })
  })

  it('aggiunge nel primo spazio libero alla dimensione predefinita', () => {
    expect(addWidget([a, b], widget('n')).at(-1)).toEqual({ id: 'n', x: 16, y: 0, w: 8, h: 6 })
  })
})

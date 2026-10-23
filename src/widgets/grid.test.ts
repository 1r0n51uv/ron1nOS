import { describe, expect, it } from 'vitest'

import { firstFree, gridRows, overlaps, place } from './grid'

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

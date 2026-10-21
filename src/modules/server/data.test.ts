import { describe, expect, it } from 'vitest'

import { headerMeta, isHot, percent, THRESHOLDS, topContainers } from './data'

describe('percent', () => {
  it('arrotonda al numero intero', () => {
    expect(percent(23.4)).toBe(23)
    expect(percent(82.5)).toBe(83)
  })

  it('resta tra 0 e 100', () => {
    expect(percent(-3)).toBe(0)
    expect(percent(104.2)).toBe(100)
  })
})

describe('headerMeta', () => {
  it('unisce temperatura arrotondata e uptime', () => {
    expect(headerMeta({ tempC: 51.6, uptimeSec: 41 * 86_400 })).toBe('52 °C · 41 g')
  })

  it('omette la temperatura se manca il sensore', () => {
    expect(headerMeta({ uptimeSec: 3 * 86_400 })).toBe('3 g')
  })
})

describe('topContainers', () => {
  it('ordina per CPU e a parità per RAM', () => {
    const list = [
      { name: 'a', cpu: 0, memBytes: 10 },
      { name: 'b', cpu: 0, memBytes: 30 },
      { name: 'c', cpu: 5, memBytes: 1 },
      { name: 'd', cpu: 0, memBytes: 20 },
    ]
    expect(topContainers(list).map((c) => c.name)).toEqual(['c', 'b', 'd'])
  })

  it('non modifica la lista originale', () => {
    const list = [
      { name: 'a', cpu: 1, memBytes: 1 },
      { name: 'b', cpu: 2, memBytes: 1 },
    ]
    topContainers(list)
    expect(list[0].name).toBe('a')
  })
})

describe('soglie', () => {
  it('anelli rossi da 80% e temperatura da 85 °C', () => {
    expect(THRESHOLDS).toEqual({ percent: 80, tempC: 85 })
  })

  it('isHot considera la temperatura arrotondata', () => {
    expect(isHot(84.4)).toBe(false)
    expect(isHot(84.5)).toBe(true)
    expect(isHot(undefined)).toBe(false)
  })
})

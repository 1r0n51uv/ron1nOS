import { describe, expect, it } from 'vitest'

import { headerMeta, percent } from './data'

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

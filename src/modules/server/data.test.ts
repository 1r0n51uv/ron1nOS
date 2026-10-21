import { describe, expect, it } from 'vitest'

import { percent } from './data'

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

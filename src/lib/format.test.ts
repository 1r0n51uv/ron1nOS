import { describe, expect, it } from 'vitest'

import { clock, greeting, num, signed } from './format'

describe('num', () => {
  // In it-IT il punto delle migliaia compare da cinque cifre (1234 resta 1234).
  it('usa la virgola decimale e il punto delle migliaia', () => {
    expect(num(12345.5, 1)).toBe('12.345,5')
    expect(num(2, 2)).toBe('2,00')
  })
})

describe('signed', () => {
  it('usa il segno meno tipografico', () => {
    expect(signed(-0.4)).toBe('−0,4')
    expect(signed(1.25, 2)).toBe('+1,25')
  })
})

describe('clock', () => {
  it('formatta minuti e secondi e non va sotto zero', () => {
    expect(clock(75)).toBe('01:15')
    expect(clock(-3)).toBe('00:00')
  })
})

describe('greeting', () => {
  it.each([
    [3, 'Buonanotte.'],
    [9, 'Buongiorno.'],
    [15, 'Buon pomeriggio.'],
    [21, 'Buonasera.'],
  ])('alle %i dice %s', (hour, expected) => {
    expect(greeting(new Date(2026, 9, 20, hour))).toBe(expected)
  })
})

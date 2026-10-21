import { describe, expect, it } from 'vitest'

import { bytes, clock, greeting, num, rate, signed, uptime } from './format'

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

describe('uptime', () => {
  it('sotto un giorno usa le ore', () => {
    expect(uptime(7 * 3_600 + 59 * 60)).toBe('7 h')
    expect(uptime(0)).toBe('0 h')
  })

  it('da un giorno in su usa i giorni', () => {
    expect(uptime(24 * 3_600)).toBe('1 g')
    expect(uptime(41 * 86_400 + 3_600)).toBe('41 g')
  })
})

describe('rate', () => {
  it('sotto 1 MB/s usa i kB/s interi', () => {
    expect(rate(820_400)).toBe('820 kB/s')
    expect(rate(0)).toBe('0 kB/s')
  })

  it('da 1 MB/s usa i MB/s con un decimale', () => {
    expect(rate(12_400_000)).toBe('12,4 MB/s')
  })
})

describe('bytes', () => {
  it('sotto 1 GB usa i MB interi', () => {
    expect(bytes(412_300_000)).toBe('412 MB')
  })

  it('da 1 GB usa i GB con un decimale', () => {
    expect(bytes(1_240_000_000)).toBe('1,2 GB')
  })
})

import { describe, expect, it } from 'vitest'

import { makeFormats } from '@/preferences/formats'
import { energyText, goalLine, ringLabels, whenLine } from './format'

const kj = makeFormats({ timeZone: 'Europe/Rome', weightUnit: 'kg', energyUnit: 'kJ' })

describe('energia nell’unità scelta (SET-010)', () => {
  it('kcal di base, kJ se scelti', () => {
    expect(energyText(2000)).toBe('2000 kcal')
    expect(energyText(285, kj)).toBe('1192 kJ')
  })

  it('anello delle calorie', () => {
    expect(ringLabels(285, 2000, kj)).toEqual({
      label: '1192',
      sublabel: 'di 8368 kJ',
      ariaLabel: '1192 kJ su 8368',
    })
    expect(ringLabels(285, 0)).toEqual({ label: '285', sublabel: 'kcal', ariaLabel: '285 kcal' })
  })

  it('obiettivo su una riga', () => {
    expect(goalLine({ kcal: 2000, protein: 120, carbs: 220, fat: 65 }, kj)).toBe(
      '8368 kJ · P 120 · C 220 · G 65 g',
    )
  })
})

describe('whenLine', () => {
  it('ora nel fuso scelto', () => {
    const now = new Date('2026-10-20T20:00:00Z')
    expect(whenLine('2026-10-20T08:12:00Z', now)).toBe('oggi 10:12')
    expect(whenLine('2026-10-20T08:12:00Z', now, 'UTC')).toBe('oggi 08:12')
  })
})

import { describe, expect, it } from 'vitest'

import { makeFormats, toEnergy, toWeight } from './formats'

describe('formati (SET-010)', () => {
  it('kcal e kg restano come sono', () => {
    expect(toEnergy(2000, 'kcal')).toBe(2000)
    expect(toWeight(80, 'kg')).toBe(80)
  })

  it('kJ e libbre si convertono solo per mostrarli', () => {
    expect(toEnergy(1, 'kJ')).toBeCloseTo(4.184)
    expect(toWeight(80, 'lb')).toBeCloseTo(176.37, 2)
  })

  it('makeFormats tiene le scelte e aggiunge le conversioni', () => {
    const fmt = makeFormats({ timeZone: 'Europe/Rome', weightUnit: 'lb', energyUnit: 'kJ' })
    expect(fmt.timeZone).toBe('Europe/Rome')
    expect(fmt.energy(100)).toBeCloseTo(418.4)
    expect(fmt.weight(1)).toBeCloseTo(2.2046)
  })
})

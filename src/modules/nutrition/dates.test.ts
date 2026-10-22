import { describe, expect, it } from 'vitest'

import { addDays, dayOfMonth, eyebrowDay, isDay, stripDays, todayRome, weekdayShort } from './dates'

describe('giorni del diario', () => {
  it('oggi è il giorno di Roma', () => {
    expect(todayRome(new Date('2026-10-21T22:30:00Z'))).toBe('2026-10-22')
  })

  it('striscia: 10 indietro, oggi, 13 avanti', () => {
    const days = stripDays('2026-10-21')
    expect(days).toHaveLength(24)
    expect(days[0]).toBe('2026-10-11')
    expect(days[10]).toBe('2026-10-21')
    expect(days.at(-1)).toBe('2026-11-03')
  })

  it('etichette in italiano', () => {
    expect(weekdayShort('2026-10-21')).toBe('mer')
    expect(dayOfMonth('2026-10-21')).toBe('21')
    expect(eyebrowDay('2026-10-21')).toBe('MERCOLEDÌ 21 OTTOBRE')
  })

  it('somma giorni e riconosce le date', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(isDay('2026-10-21')).toBe(true)
    expect(isDay('ieri')).toBe(false)
    expect(isDay(null)).toBe(false)
  })
})

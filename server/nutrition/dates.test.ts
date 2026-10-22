// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { addDays, isDay, localHour, mondayOf, today, weekday } from './dates.ts'

describe('date del modulo', () => {
  it('oggi è il giorno di Roma, non quello UTC', () => {
    expect(today(new Date('2026-10-21T22:30:00Z'))).toBe('2026-10-22')
    expect(today(new Date('2026-10-21T21:30:00Z'))).toBe('2026-10-21')
  })

  it("l'ora locale segue l'ora legale", () => {
    expect(localHour(new Date('2026-07-01T12:00:00Z'))).toBe(14)
    expect(localHour(new Date('2026-12-01T12:00:00Z'))).toBe(13)
    expect(localHour(new Date('2026-12-01T23:30:00Z'))).toBe(0)
  })

  it('riconosce solo date vere', () => {
    expect(isDay('2026-10-22')).toBe(true)
    expect(isDay('2026-02-30')).toBe(false)
    expect(isDay('22/10/2026')).toBe(false)
    expect(isDay(20261022)).toBe(false)
  })

  it('somma giorni attraverso mesi e anni', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('settimana da lunedì', () => {
    expect(weekday('2026-10-19')).toBe(1)
    expect(weekday('2026-10-25')).toBe(7)
    expect(mondayOf('2026-10-25')).toBe('2026-10-19')
    expect(mondayOf('2026-10-19')).toBe('2026-10-19')
  })
})

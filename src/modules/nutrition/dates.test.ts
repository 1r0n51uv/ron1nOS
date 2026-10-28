import { describe, expect, it } from 'vitest'

import {
  addDays,
  dayOfMonth,
  eyebrowDay,
  isDay,
  mondayOf,
  stripDays,
  stripWeeks,
  todayRome,
  weekdayShort,
  weekRange,
} from './dates'

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

describe('settimane', () => {
  it('la striscia si raggruppa per settimana da lunedì (DES-006)', () => {
    const weeks = stripWeeks('2026-10-21')
    expect(weeks.map((w) => [w.monday, w.days.length])).toEqual([
      ['2026-10-05', 1],
      ['2026-10-12', 7],
      ['2026-10-19', 7],
      ['2026-10-26', 7],
      ['2026-11-02', 2],
    ])
    expect(weeks.flatMap((w) => w.days)).toEqual(stripDays('2026-10-21'))
  })

  it('lunedì della settimana e intervallo', () => {
    expect(mondayOf('2026-10-21')).toBe('2026-10-19')
    expect(mondayOf('2026-10-25')).toBe('2026-10-19')
    expect(mondayOf('2026-10-19')).toBe('2026-10-19')
    expect(weekRange('2026-10-19')).toBe('19–25 ott')
    expect(weekRange('2026-10-26')).toBe('26 ott–1 nov')
  })
})

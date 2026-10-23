import { describe, expect, it } from 'vitest'

import { expiryOf } from './status.ts'

const now = new Date('2026-10-22T10:00:00Z')

describe('scadenze (DOC-010)', () => {
  it('senza data niente stato', () => {
    expect(expiryOf(null, [90, 30, 7], now)).toBeNull()
  })

  it('in scadenza dal primo preavviso attivo, scaduto dal giorno dopo', () => {
    expect(expiryOf('2027-01-21', [90, 30, 7], now)).toEqual({ status: 'ok', daysLeft: 91 })
    expect(expiryOf('2027-01-20', [90, 30, 7], now)).toEqual({ status: 'expiring', daysLeft: 90 })
    expect(expiryOf('2026-10-22', [90], now)).toEqual({ status: 'expiring', daysLeft: 0 })
    expect(expiryOf('2026-10-21', [90], now)).toEqual({ status: 'expired', daysLeft: -1 })
  })

  it('senza preavvisi è in scadenza solo il giorno stesso', () => {
    expect(expiryOf('2026-10-23', [], now)).toEqual({ status: 'ok', daysLeft: 1 })
    expect(expiryOf('2026-10-22', [], now)).toEqual({ status: 'expiring', daysLeft: 0 })
  })

  it('il giorno è quello di Roma', () => {
    // 23:30 UTC del 21 è già il 22 a Roma.
    expect(expiryOf('2026-10-22', [], new Date('2026-10-21T23:30:00Z'))).toEqual({
      status: 'expiring',
      daysLeft: 0,
    })
  })
})

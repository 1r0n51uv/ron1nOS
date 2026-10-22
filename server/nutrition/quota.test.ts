// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { quotaFor } from './quota.ts'

describe('quota del giorno (NUT-016)', () => {
  it('somma l’energia attiva all’obiettivo di base', () => {
    expect(quotaFor(2021, { kcal: 77, counted: true })).toEqual({
      kcal: 2098,
      baseKcal: 2021,
      activityKcal: 77,
    })
  })

  it('applica il tetto di +1200 kcal', () => {
    expect(quotaFor(2021, { kcal: 1850, counted: true })).toEqual({
      kcal: 3221,
      baseKcal: 2021,
      activityKcal: 1200,
    })
  })

  it('senza attività contata, o senza YAZIO, è l’obiettivo di base', () => {
    expect(quotaFor(2021, { kcal: 300, counted: false }).kcal).toBe(2021)
    expect(quotaFor(2021, null)).toEqual({ kcal: 2021, baseKcal: 2021, activityKcal: 0 })
    expect(quotaFor(2021, { kcal: -40, counted: true }).kcal).toBe(2021)
  })
})

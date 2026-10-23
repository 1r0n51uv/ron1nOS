// Stessi casi di GymMathTests e GymStatsTests di 1r0-pkm, più quelli nuovi
// della specifica (esercizi a tempo, settimana da lunedì).
import { describe, expect, it } from 'vitest'

import {
  bestEstimated1RM,
  epley1RM,
  isTimed,
  normalizeExercise,
  streakDays,
  volume,
  workingSets,
  workoutsThisWeek,
} from './math.ts'

const set = (
  weightKg: number,
  reps: number | null,
  extra: Partial<{ isWarmup: boolean; durationSeconds: number }> = {},
) => ({
  weightKg,
  reps,
  isWarmup: extra.isWarmup ?? false,
  durationSeconds: extra.durationSeconds ?? null,
})

describe('epley1RM', () => {
  it('a una ripetizione è il peso stesso', () => {
    expect(epley1RM(100, 1)).toBe(100)
  })

  it('calcola il valore noto', () => {
    expect(epley1RM(100, 5)).toBeCloseTo(116.6667, 3)
    expect(epley1RM(80, 6)).toBeCloseTo(96, 6)
  })

  it('più ripetizioni danno una stima più alta', () => {
    expect(epley1RM(100, 8)).toBeGreaterThan(epley1RM(100, 5))
  })

  it('reps a zero o peso negativo danno 0', () => {
    expect(epley1RM(100, 0)).toBe(0)
    expect(epley1RM(-10, 5)).toBe(0)
    expect(epley1RM(0, 5)).toBe(0)
  })
})

describe('volume e miglior 1RM', () => {
  it('somma peso × reps', () => {
    expect(
      volume([
        { weightKg: 100, reps: 5 },
        { weightKg: 102.5, reps: 5 },
        { weightKg: 60, reps: 10 },
      ]),
    ).toBeCloseTo(1612.5, 6)
  })

  it('senza serie il volume è 0', () => {
    expect(volume([])).toBe(0)
  })

  it('il miglior 1RM è quello della serie più forte', () => {
    expect(
      bestEstimated1RM([
        { weightKg: 120, reps: 1 },
        { weightKg: 100, reps: 5 },
        { weightKg: 90, reps: 8 },
      ]),
    ).toBeCloseTo(120, 6)
  })
})

describe('workingSets', () => {
  it('scarta riscaldamento, serie a 0 kg e serie a tempo', () => {
    const sets = [
      set(40, 10, { isWarmup: true }),
      set(0, 15),
      set(0, null, { durationSeconds: 60 }),
      set(80, 6),
      set(80, 0),
    ]
    expect(workingSets(sets)).toEqual([{ weightKg: 80, reps: 6 }])
  })
})

describe('isTimed', () => {
  it('riconosce un esercizio a tempo dalla maggior parte delle serie', () => {
    expect(isTimed([set(0, null, { durationSeconds: 60 }), set(0, null, { durationSeconds: 75 })])).toBe(true)
    expect(isTimed([set(80, 6), set(80, 6), set(0, null, { durationSeconds: 30 })])).toBe(false)
    expect(isTimed([])).toBe(false)
  })

  it('il riscaldamento non conta', () => {
    expect(isTimed([set(20, 10, { isWarmup: true }), set(0, null, { durationSeconds: 90 })])).toBe(true)
  })
})

describe('normalizeExercise', () => {
  it('ignora maiuscole e spazi in più', () => {
    expect(normalizeExercise('  Panca   Piana ')).toBe('panca piana')
  })
})

describe('streakDays', () => {
  it('tre giorni consecutivi fino a oggi', () => {
    expect(streakDays(['2026-09-06', '2026-09-05', '2026-09-04', '2026-09-01'], '2026-09-06')).toBe(3)
  })

  it('parte da ieri se oggi non ci si è allenati', () => {
    expect(streakDays(['2026-09-05', '2026-09-04'], '2026-09-06')).toBe(2)
  })

  it('si interrompe se l ultimo allenamento è prima di ieri', () => {
    expect(streakDays(['2026-09-03', '2026-09-02'], '2026-09-06')).toBe(0)
  })

  it('più sessioni nello stesso giorno contano una volta', () => {
    expect(streakDays(['2026-09-06', '2026-09-06', '2026-09-05'], '2026-09-06')).toBe(2)
  })

  it('senza sessioni è 0', () => {
    expect(streakDays([], '2026-09-06')).toBe(0)
  })

  it('attraversa la fine del mese', () => {
    expect(streakDays(['2026-10-01', '2026-09-30', '2026-09-29'], '2026-10-01')).toBe(3)
  })
})

describe('workoutsThisWeek', () => {
  it('conta le sessioni da lunedì a oggi', () => {
    // 2026-09-06 è domenica: la settimana parte lunedì 31 agosto.
    expect(workoutsThisWeek(['2026-09-06', '2026-09-02', '2026-08-30'], '2026-09-06')).toBe(2)
  })

  it('di lunedì conta solo il lunedì', () => {
    expect(workoutsThisWeek(['2026-10-19', '2026-10-18'], '2026-10-19')).toBe(1)
  })

  it('due sessioni nello stesso giorno contano due', () => {
    expect(workoutsThisWeek(['2026-10-22', '2026-10-22'], '2026-10-22')).toBe(2)
  })
})

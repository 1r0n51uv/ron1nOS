import { describe, expect, it } from 'vitest'

import {
  dayWithYear,
  clock,
  duration,
  exerciseBest,
  groupLabel,
  period,
  setLabel,
  startTime,
  streak,
  weeklyAverage,
  workoutDay,
  workouts,
} from './format'

describe('format', () => {
  it('giorni e periodi', () => {
    expect(dayWithYear('2026-10-19')).toBe('19 ott 2026')
    expect(period('2026-10-19', '2026-10-19')).toBe('19 ott 2026')
    expect(period('2024-03-04', '2026-10-21')).toBe('4 mar 2024 – 21 ott 2026')
  })

  it('singolare e plurale', () => {
    expect(workouts(1)).toBe('1 allenamento')
    expect(workouts(0)).toBe('0 allenamenti')
    expect(streak(1)).toBe('1 giorno di fila')
    expect(streak(4)).toBe('4 giorni di fila')
  })

  it('media per settimana', () => {
    expect(weeklyAverage([{ count: 3 }, { count: 2 }, { count: 2 }])).toBe(2.3)
    expect(weeklyAverage([])).toBe(0)
  })
})

describe('workoutDay e duration', () => {
  it('oggi, ieri o data estesa', () => {
    expect(workoutDay('2026-10-22', '2026-10-22')).toBe('oggi')
    expect(workoutDay('2026-10-21', '2026-10-22')).toBe('ieri')
    expect(workoutDay('2026-10-20', '2026-10-22')).toBe('martedì 20 ottobre')
  })

  it('minuti e ore', () => {
    expect(duration(2700)).toBe('45 min')
    expect(duration(3900)).toBe('1 h 05 min')
  })
})

describe('setLabel e startTime', () => {
  it('peso × reps o durata', () => {
    expect(setLabel({ weightKg: 85, reps: 6, durationSeconds: null })).toBe('85 × 6')
    expect(setLabel({ weightKg: 82.5, reps: 6, durationSeconds: null })).toBe('82,5 × 6')
    expect(setLabel({ weightKg: 0, reps: null, durationSeconds: 75 })).toBe('1:15')
  })

  it('ora di Roma', () => {
    expect(startTime('2026-10-20T16:00:00Z')).toBe('18:00')
  })
})

describe('exerciseBest', () => {
  it('1RM arrotondato in kg, durata per gli esercizi a tempo', () => {
    expect(exerciseBest({ best1RMKg: 75.83, bestDurationSeconds: null })).toBe('76 kg')
    expect(exerciseBest({ best1RMKg: null, bestDurationSeconds: 90 })).toBe('1:30')
    expect(exerciseBest({ best1RMKg: null, bestDurationSeconds: null })).toBe('–')
  })
})

describe('groupLabel e clock', () => {
  it('nome del gruppo, Non assegnato se manca', () => {
    expect(groupLabel('petto')).toBe('Petto')
    expect(groupLabel(null)).toBe('Non assegnato')
    expect(groupLabel('boh')).toBe('Non assegnato')
  })

  it('durata come minuti e secondi', () => {
    expect(clock(90)).toBe('1:30')
    expect(clock(725)).toBe('12:05')
  })
})

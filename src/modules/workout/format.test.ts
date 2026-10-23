import { describe, expect, it } from 'vitest'

import {
  dayWithYear,
  clock,
  duration,
  exerciseBest,
  groupLabel,
  mass,
  massTotal,
  recordLabel,
  period,
  setLabel,
  startTime,
  streak,
  weeklyAverage,
  workoutDay,
  workouts,
} from './format'
import { makeFormats } from '@/preferences/formats'

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

describe('recordLabel', () => {
  it('un testo per tipo di record', () => {
    expect(recordLabel({ kind: 'e1rm', value: 81.67, weightKg: null })).toBe('1RM stimato · 82 kg')
    expect(recordLabel({ kind: 'weight', value: 72.5, weightKg: null })).toBe('Peso più alto · 72,5 kg')
    expect(recordLabel({ kind: 'volume', value: 630.4, weightKg: null })).toBe(
      'Volume in una sessione · 630 kg',
    )
    expect(recordLabel({ kind: 'reps', value: 8, weightKg: 60 })).toBe('Più ripetizioni a 60 kg · 8')
    expect(recordLabel({ kind: 'duration', value: 95, weightKg: null })).toBe('Durata più lunga · 1:35')
  })
})

describe('unità e fuso scelti (SET-010)', () => {
  const lb = makeFormats({ timeZone: 'America/New_York', weightUnit: 'lb', energyUnit: 'kcal' })

  it('carichi e 1RM in libbre', () => {
    expect(setLabel({ weightKg: 100, reps: 5, durationSeconds: null }, lb)).toBe('220,5 × 5')
    expect(exerciseBest({ best1RMKg: 100, bestDurationSeconds: null }, lb)).toBe('220 lb')
    expect(massTotal(1000, lb)).toBe('2205 lb')
    expect(mass(20)).toBe('20')
    expect(recordLabel({ kind: 'reps', value: 8, weightKg: 60 }, lb)).toBe('Più ripetizioni a 132,3 lb · 8')
  })

  it('ora nel fuso scelto', () => {
    expect(startTime('2026-10-20T16:00:00Z', lb.timeZone)).toBe('12:00')
  })
})

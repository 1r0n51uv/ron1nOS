// Parser del CSV di Liftin': gli stessi casi di LiftinCSVTests di 1r0-pkm,
// più fuso di Roma e righe scartate.
import { describe, expect, it } from 'vitest'

import { LiftinError, parseLiftin } from './liftin.ts'

const HEADER = 'Date;Duration;Routine;Exercise;Set;Warmup;Weight;Reps/Time;Goal;Perception'

describe('parseLiftin', () => {
  it('legge una riga completa', () => {
    const { rows, skipped } = parseLiftin(`${HEADER}\n2026-10-20 18:30;1h 05m;Push;Panca piana;2;0;82,5;6;;8`)
    expect(skipped).toBe(0)
    expect(rows).toEqual([
      {
        day: '2026-10-20',
        startedAt: new Date('2026-10-20T16:30:00Z'),
        routine: 'Push',
        workoutDurationSeconds: 3900,
        exercise: 'Panca piana',
        setIndex: 2,
        isWarmup: false,
        weightKg: 82.5,
        reps: 6,
        setDurationSeconds: null,
        perception: 8,
      },
    ])
  })

  it('cerca le colonne per nome, in qualsiasi ordine', () => {
    const { rows } = parseLiftin('exercise;SET;date;reps\nSquat;1;2026-01-10;5')
    expect(rows[0]).toMatchObject({ exercise: 'Squat', setIndex: 1, day: '2026-01-10', reps: 5, routine: '' })
  })

  it('Reps/Time con i due punti è una durata', () => {
    const { rows } = parseLiftin(`${HEADER}\n2026-10-20;;Core;Plank;1;;0;1:15;;`)
    expect(rows[0]).toMatchObject({ reps: null, setDurationSeconds: 75 })
  })

  it('riconosce riscaldamento, decimali e durate diverse', () => {
    const { rows } = parseLiftin(
      [
        HEADER,
        '20/10/2026 07:05;45 min;Gambe;Squat;1;yes;60;10;;',
        '20/10/2026 07:05;45 min;Gambe;Squat;2;0;100.5;5,0;;',
        '"2026-10-21";"01:02:03";Pull;"Rematore";1;x;70;8;;',
      ].join('\r\n'),
    )
    expect(rows.map((r) => [r.isWarmup, r.weightKg, r.reps, r.workoutDurationSeconds])).toEqual([
      [true, 60, 10, 2700],
      [false, 100.5, 5, 2700],
      [true, 70, 8, 3723],
    ])
    expect(rows[2]!.exercise).toBe('Rematore')
  })

  it('le ore senza fuso sono ore di Roma, anche con l ora legale', () => {
    const { rows } = parseLiftin('Date;Exercise;Set\n2026-01-15 10:00;A;1\n2026-07-15 10:00;A;1')
    expect(rows.map((r) => r.startedAt.toISOString())).toEqual([
      '2026-01-15T09:00:00.000Z',
      '2026-07-15T08:00:00.000Z',
    ])
  })

  it('con il fuso il giorno è quello di Roma', () => {
    const { rows } = parseLiftin('Date;Exercise;Set\n2026-10-20T23:30:00Z;A;1')
    expect(rows[0]!.day).toBe('2026-10-21')
  })

  it('MM/dd/yyyy quando il secondo numero non può essere un mese', () => {
    expect(parseLiftin('Date;Exercise;Set\n10/25/2026;A;1').rows[0]!.day).toBe('2026-10-25')
  })

  it('scarta e conta le righe senza data valida o esercizio', () => {
    const { rows, skipped } = parseLiftin(
      [
        'Date;Exercise;Set',
        ';Panca;1',
        '2026-10-20;;1',
        '31/02/2026;Panca;1',
        'ieri;Panca;1',
        '2026-10-20;Panca;',
      ].join('\n'),
    )
    expect(skipped).toBe(4)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.setIndex).toBe(1)
  })

  it('errori chiari', () => {
    expect(() => parseLiftin('')).toThrow(new LiftinError('Il file è vuoto'))
    expect(() => parseLiftin('﻿\n  \n')).toThrow('Il file è vuoto')
    expect(() => parseLiftin('Routine;Weight\nPush;80')).toThrow('Colonne mancanti: Date, Exercise, Set')
    expect(() => parseLiftin('Date;Exercise;Weight\n2026-10-20;Panca;80')).toThrow('Colonne mancanti: Set')
    expect(() => parseLiftin(`${HEADER}\n;;;;;;;;;`)).toThrow('Nessuna riga valida nel CSV')
  })
})

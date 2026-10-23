// @vitest-environment node
// Riepilogo del modulo Allenamento (GYM-013) su un Postgres vero.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createApp } from '../app.ts'
import { testDb } from '../testing/db.ts'
import { fakeQbt } from '../testing/fake-qbt.ts'
import type { WorkoutSummary } from './summary.ts'

let db: Awaited<ReturnType<typeof testDb>>
beforeAll(async () => {
  db = await testDb()
})
afterAll(() => db.drop())
beforeEach(async () => {
  await db.query('truncate workout_sessions, workout_exercises cascade')
})

// Giovedì 22 ottobre 2026, 10:00 a Roma.
const NOW = new Date('2026-10-22T08:00:00Z')

async function session(day: string, routine = 'Push', exercises: string[] = [], at = '18:00') {
  const { rows } = await db.query<{ id: string }>(
    `insert into workout_sessions (day, routine, started_at, duration_seconds)
     values ($1::date, $2, ($1::text || ' ' || $3)::timestamp at time zone 'Europe/Rome', 3600) returning id`,
    [day, routine, at],
  )
  for (const [i, name] of exercises.entries()) {
    await db.query(
      `insert into workout_sets (session_id, exercise_name, exercise_key, exercise_order, set_index, weight_kg, reps)
       values ($1, $2, lower($2), $3, 1, 50, 8)`,
      [rows[0]!.id, name, i + 1],
    )
  }
  return rows[0]!.id
}

async function summary() {
  const res = await createApp({
    qbt: fakeQbt(),
    database: { db, status: () => 'ok' },
    workout: { now: () => NOW },
  }).request('/api/v1/workout/summary')
  expect(res.status).toBe(200)
  return (await res.json()) as WorkoutSummary & { last: NonNullable<WorkoutSummary['last']> }
}

describe('GET /summary', () => {
  it('senza sessioni', async () => {
    const s = await summary()
    expect(s).toMatchObject({ today: '2026-10-22', last: null, thisWeek: 0, streakDays: 0 })
    expect(s.weeks).toHaveLength(26)
    expect(s.weeks[25]).toEqual({ monday: '2026-10-19', count: 0 })
    expect(s.weeks[0]).toEqual({ monday: '2026-04-27', count: 0 })
  })

  it('ultimo allenamento con il primo esercizio e la sua immagine', async () => {
    await session('2026-10-19', 'Gambe', ['Squat'])
    const id = await session('2026-10-21', 'Push', ['Panca piana', 'Croci'])
    const s = await summary()
    expect(s.last).toEqual({
      id,
      day: '2026-10-21',
      routine: 'Push',
      startedAt: '2026-10-21T16:00:00.000Z',
      durationSeconds: 3600,
      exercise: {
        name: 'Panca piana',
        image: {
          catalogId: 'Barbell_Bench_Press_-_Medium_Grip',
          source: 'dictionary',
          url: '/api/v1/workout/catalog/images/Barbell_Bench_Press_-_Medium_Grip/0.jpg',
        },
      },
    })
  })

  it('settimana da lunedì, giorni di fila fino a ieri, settimane passate', async () => {
    await session('2026-10-18', 'Pull') // domenica scorsa
    await session('2026-10-20', 'Push')
    await session('2026-10-21', 'Gambe')
    await session('2026-10-21', 'Core')
    await session('2026-10-07', 'Push')
    await session('2026-10-30', 'Futuro') // dopo oggi: non conta
    const s = await summary()
    expect(s.thisWeek).toBe(3)
    expect(s.streakDays).toBe(2)
    expect(s.weeks.slice(-3)).toEqual([
      { monday: '2026-10-05', count: 1 },
      { monday: '2026-10-12', count: 1 },
      { monday: '2026-10-19', count: 3 },
    ])
    expect(s.last.routine).not.toBe('Futuro')
  })
})

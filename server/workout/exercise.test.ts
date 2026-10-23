// @vitest-environment node
// Pagina di un esercizio (GYM-008) su un Postgres vero.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createApp } from '../app.ts'
import { testDb } from '../testing/db.ts'
import { fakeQbt } from '../testing/fake-qbt.ts'
import type { ExerciseDetail } from './exercise.ts'

let db: Awaited<ReturnType<typeof testDb>>
beforeAll(async () => {
  db = await testDb()
})
afterAll(() => db.drop())
beforeEach(async () => {
  await db.query('truncate workout_sessions, workout_exercises cascade')
})

type SetInput = { kg?: number; reps?: number | null; seconds?: number | null; warmup?: boolean }

async function session(day: string, name: string, sets: SetInput[]) {
  const { rows } = await db.query<{ id: string }>(
    `insert into workout_sessions (day, routine, started_at)
     values ($1::date, 'Push', ($1::text || ' 18:00')::timestamp at time zone 'Europe/Rome') returning id`,
    [day],
  )
  for (const [j, s] of sets.entries()) {
    await db.query(
      `insert into workout_sets (session_id, exercise_name, exercise_key, exercise_order, set_index,
                                 is_warmup, weight_kg, reps, duration_seconds)
       values ($1, $2, lower($2), 1, $3, $4, $5, $6, $7)`,
      [rows[0]!.id, name, j + 1, s.warmup ?? false, s.kg ?? 0, s.reps ?? null, s.seconds ?? null],
    )
  }
  return rows[0]!.id
}

const NOW = new Date('2026-10-22T10:00:00Z')

async function get(path: string) {
  const res = await createApp({
    qbt: fakeQbt(),
    database: { db, status: () => 'ok' },
    workout: { now: () => NOW },
  }).request(`/api/v1/workout${path}`)
  return { status: res.status, body: (await res.json()) as ExerciseDetail }
}

describe('GET /exercises/{name}', () => {
  it('testata su tutto lo storico, punti nel periodo, ultime 3 volte', async () => {
    await session('2025-01-10', 'Panca piana', [{ kg: 100, reps: 1 }])
    await session('2026-09-01', 'Panca piana', [
      { kg: 40, reps: 10, warmup: true },
      { kg: 60, reps: 8 },
    ])
    const third = await session('2026-10-01', 'Panca piana', [
      { kg: 70, reps: 5 },
      { kg: 70, reps: 4 },
    ])
    const last = await session('2026-10-20', 'Panca Piana', [{ kg: 72.5, reps: 3 }])
    await db.query(
      `insert into workout_exercises (exercise_key, muscle_group) values ('panca piana', 'petto')`,
    )

    const { status, body } = await get('/exercises/PANCA%20%20piana')
    expect(status).toBe(200)
    expect(body).toMatchObject({
      name: 'Panca Piana',
      key: 'panca piana',
      group: 'petto',
      timed: false,
      best1RMKg: 100,
      heaviestKg: 100,
      bestDurationSeconds: null,
      sessions: 4,
      range: '6m',
      image: { catalogId: 'Barbell_Bench_Press_-_Medium_Grip' },
    })
    // 6 mesi: la sessione del 2025 resta fuori dal grafico.
    expect(body.points.map((p) => [p.day, Math.round(p.best1RMKg * 10) / 10, p.volumeKg])).toEqual([
      ['2026-09-01', 76, 480],
      ['2026-10-01', 81.7, 630],
      ['2026-10-20', 79.8, 217.5],
    ])
    expect(body.recent.map((r) => r.sessionId)).toEqual([last, third, expect.any(String)])
    expect(body.recent[2]!.sets).toEqual([
      { warmup: true, weightKg: 40, reps: 10, durationSeconds: null },
      { warmup: false, weightKg: 60, reps: 8, durationSeconds: null },
    ])

    const all = await get('/exercises/panca%20piana?range=all')
    expect(all.body.points).toHaveLength(4)
    const short = await get('/exercises/panca%20piana?range=3m')
    expect(short.body.points.map((p) => p.day)).toEqual(['2026-09-01', '2026-10-01', '2026-10-20'])
  })

  it('un esercizio a tempo porta durata migliore e totale', async () => {
    await session('2026-10-10', 'Plank', [{ seconds: 60 }, { seconds: 45 }, { seconds: 30, warmup: true }])
    const { body } = await get('/exercises/plank')
    expect(body).toMatchObject({ timed: true, best1RMKg: null, heaviestKg: null, bestDurationSeconds: 60 })
    expect(body.points[0]).toMatchObject({ bestDurationSeconds: 60, totalDurationSeconds: 105 })
    expect(body.recent[0]!.best1RMKg).toBeNull()
  })

  it('404 per un nome sconosciuto, 400 per un periodo sbagliato', async () => {
    expect((await get('/exercises/nessuno')).status).toBe(404)
    await session('2026-10-10', 'Squat', [{ kg: 80, reps: 5 }])
    expect((await get('/exercises/squat?range=2y')).status).toBe(400)
  })
})

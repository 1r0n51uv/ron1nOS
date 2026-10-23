// @vitest-environment node
// Esercizi (GYM-007, GYM-009) su un Postgres vero.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createApp } from '../app.ts'
import { testDb } from '../testing/db.ts'
import { fakeQbt } from '../testing/fake-qbt.ts'
import type { ExerciseRow } from './exercises.ts'

let db: Awaited<ReturnType<typeof testDb>>
beforeAll(async () => {
  db = await testDb()
})
afterAll(() => db.drop())
beforeEach(async () => {
  await db.query('truncate workout_sessions, workout_exercises cascade')
})

type SetInput = { kg?: number; reps?: number | null; seconds?: number | null; warmup?: boolean }

async function session(day: string, exercises: Record<string, SetInput[]>) {
  const { rows } = await db.query<{ id: string }>(
    `insert into workout_sessions (day, routine, started_at)
     values ($1::date, 'Push', ($1::text || ' 18:00')::timestamp at time zone 'Europe/Rome') returning id`,
    [day],
  )
  for (const [i, [name, sets]] of Object.entries(exercises).entries()) {
    for (const [j, s] of sets.entries()) {
      await db.query(
        `insert into workout_sets (session_id, exercise_name, exercise_key, exercise_order, set_index,
                                   is_warmup, weight_kg, reps, duration_seconds)
         values ($1, $2, lower($2), $3, $4, $5, $6, $7, $8)`,
        [rows[0]!.id, name, i + 1, j + 1, s.warmup ?? false, s.kg ?? 0, s.reps ?? null, s.seconds ?? null],
      )
    }
  }
}

async function get(path: string) {
  const res = await createApp({ qbt: fakeQbt(), database: { db, status: () => 'ok' } }).request(
    `/api/v1/workout${path}`,
  )
  return { status: res.status, body: (await res.json()) as { exercises: ExerciseRow[] } }
}

describe('GET /exercises', () => {
  it('uno per nome, con 1RM, andamento, gruppo e immagine', async () => {
    await session('2026-10-01', {
      'Panca piana': [
        { kg: 20, reps: 10, warmup: true },
        { kg: 60, reps: 8 },
      ],
    })
    await session('2026-10-08', {
      'PANCA PIANA': [
        { kg: 70, reps: 1 },
        { kg: 65, reps: 5 },
      ],
    })
    await db.query(
      `insert into workout_exercises (exercise_key, muscle_group) values ('panca piana', 'petto')`,
    )
    const { status, body } = await get('/exercises')
    expect(status).toBe(200)
    expect(body.exercises).toHaveLength(1)
    const [panca] = body.exercises
    expect(panca).toMatchObject({
      name: 'PANCA PIANA',
      key: 'panca piana',
      group: 'petto',
      timed: false,
      sets: 3,
      sessions: 2,
      lastDay: '2026-10-08',
      bestDurationSeconds: null,
      image: { catalogId: 'Barbell_Bench_Press_-_Medium_Grip', source: 'dictionary' },
    })
    // Epley: 60 × (1 + 8/30) = 76; 65 × (1 + 5/30) ≈ 75,8.
    expect(panca!.best1RMKg).toBeCloseTo(76)
    expect(panca!.trend.map((v) => Math.round(v * 10) / 10)).toEqual([76, 75.8])
  })

  it('per un esercizio a tempo la durata più lunga al posto dell 1RM', async () => {
    await session('2026-10-01', { Plank: [{ seconds: 60 }, { seconds: 45 }] })
    await session('2026-10-03', { Plank: [{ seconds: 90 }] })
    const [plank] = (await get('/exercises')).body.exercises
    expect(plank).toMatchObject({ timed: true, best1RMKg: null, bestDurationSeconds: 90, trend: [60, 90] })
  })

  it('sort=sets mette prima i più allenati, limit taglia, q cerca nel nome', async () => {
    await session('2026-10-01', {
      Squat: [
        { kg: 80, reps: 5 },
        { kg: 80, reps: 5 },
        { kg: 80, reps: 5 },
      ],
    })
    await session('2026-10-05', { 'Curl manubri': [{ kg: 12, reps: 10 }] })
    await session('2026-10-06', {
      'Curl bilanciere': [
        { kg: 25, reps: 10 },
        { kg: 25, reps: 8 },
      ],
    })
    const names = async (path: string) => (await get(path)).body.exercises.map((e) => e.name)
    expect(await names('/exercises')).toEqual(['Curl bilanciere', 'Curl manubri', 'Squat'])
    expect(await names('/exercises?sort=sets')).toEqual(['Squat', 'Curl bilanciere', 'Curl manubri'])
    expect(await names('/exercises?sort=sets&limit=2')).toEqual(['Squat', 'Curl bilanciere'])
    expect(await names('/exercises?q=%20CURL')).toEqual(['Curl bilanciere', 'Curl manubri'])
  })

  it('l andamento tiene solo le ultime 12 sessioni', async () => {
    for (let i = 1; i <= 14; i++) {
      await session(`2026-09-${String(i).padStart(2, '0')}`, { Stacco: [{ kg: 100 + i, reps: 1 }] })
    }
    const [stacco] = (await get('/exercises')).body.exercises
    expect(stacco!.trend).toEqual([103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114])
  })

  it('parametri sbagliati rispondono 400', async () => {
    expect((await get('/exercises?sort=nome')).status).toBe(400)
    expect((await get('/exercises?limit=0')).status).toBe(400)
  })
})

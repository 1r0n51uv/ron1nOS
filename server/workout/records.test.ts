// @vitest-environment node
// Record personali (GYM-010): calcolo puro e rotta su un Postgres vero.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createApp } from '../app.ts'
import { testDb } from '../testing/db.ts'
import { fakeQbt } from '../testing/fake-qbt.ts'
import type { ExerciseDetail } from './exercise.ts'
import type { SetLike } from './math.ts'
import type { RecentRecord } from './records.ts'
import { personalRecords } from './records.ts'

const lift = (weightKg: number, reps: number, isWarmup = false): SetLike => ({
  isWarmup,
  weightKg,
  reps,
  durationSeconds: null,
})

describe('personalRecords', () => {
  it('la prima volta fissa i record, le sessioni dopo li battono', () => {
    const { current, events } = personalRecords(
      [
        { sessionId: 'a', day: '2026-10-01', sets: [lift(60, 8), lift(60, 6)] },
        // Il riscaldamento non conta; 62,5 × 8 batte 1RM, peso e volume.
        { sessionId: 'b', day: '2026-10-05', sets: [lift(100, 10, true), lift(62.5, 8)] },
        // 60 × 10: più ripetizioni a 60 kg, e volume più alto (600 + 0).
        { sessionId: 'c', day: '2026-10-09', sets: [lift(60, 10)] },
      ],
      false,
    )
    expect(events.map((e) => [e.sessionId, e.kind, e.weightKg, Math.round(e.value * 10) / 10])).toEqual([
      ['b', 'e1rm', null, 79.2],
      ['b', 'weight', null, 62.5],
      ['c', 'e1rm', null, 80],
      ['c', 'reps', 60, 10],
    ])
    const byKind = Object.fromEntries(current.map((r) => [`${r.kind}${r.weightKg ?? ''}`, [r.value, r.day]]))
    expect(byKind).toEqual({
      e1rm: [80, '2026-10-09'],
      weight: [62.5, '2026-10-05'],
      volume: [840, '2026-10-01'],
      reps60: [10, '2026-10-09'],
      'reps62.5': [8, '2026-10-05'],
    })
  })

  it('per un esercizio a tempo solo la durata più lunga', () => {
    const plank = (s: number): SetLike => ({ isWarmup: false, weightKg: 0, reps: null, durationSeconds: s })
    const { current, events } = personalRecords(
      [
        { sessionId: 'a', day: '2026-10-01', sets: [plank(60)] },
        { sessionId: 'b', day: '2026-10-02', sets: [plank(45)] },
        { sessionId: 'c', day: '2026-10-03', sets: [plank(75)] },
      ],
      true,
    )
    expect(events.map((e) => [e.sessionId, e.kind, e.value])).toEqual([['c', 'duration', 75]])
    expect(current).toEqual([
      { kind: 'duration', value: 75, weightKg: null, day: '2026-10-03', sessionId: 'c' },
    ])
  })

  it('serie a 0 kg escluse', () => {
    const { current } = personalRecords([{ sessionId: 'a', day: '2026-10-01', sets: [lift(0, 20)] }], false)
    expect(current).toEqual([])
  })
})

let db: Awaited<ReturnType<typeof testDb>>
beforeAll(async () => {
  db = await testDb()
})
afterAll(() => db.drop())
beforeEach(async () => {
  await db.query('truncate workout_sessions, workout_exercises cascade')
})

async function session(day: string, exercises: Record<string, [number, number][]>) {
  const { rows } = await db.query<{ id: string }>(
    `insert into workout_sessions (day, routine, started_at)
     values ($1::date, 'Push', ($1::text || ' 18:00')::timestamp at time zone 'Europe/Rome') returning id`,
    [day],
  )
  for (const [i, [name, sets]] of Object.entries(exercises).entries()) {
    for (const [j, [kg, reps]] of sets.entries()) {
      await db.query(
        `insert into workout_sets (session_id, exercise_name, exercise_key, exercise_order, set_index, weight_kg, reps)
         values ($1, $2, lower($2), $3, $4, $5, $6)`,
        [rows[0]!.id, name, i + 1, j + 1, kg, reps],
      )
    }
  }
  return rows[0]!.id
}

const NOW = new Date('2026-10-22T10:00:00Z')

async function get<T>(path: string) {
  const res = await createApp({
    qbt: fakeQbt(),
    database: { db, status: () => 'ok' },
    workout: { now: () => NOW },
  }).request(`/api/v1/workout${path}`)
  return { status: res.status, body: (await res.json()) as T }
}

describe('GET /records', () => {
  it('al massimo 3 degli ultimi 30 giorni, dal più recente, uno per esercizio e sessione', async () => {
    await session('2026-08-01', { 'Panca piana': [[60, 8]], Squat: [[80, 5]], Stacco: [[100, 5]] })
    // Fuori dai 30 giorni.
    await session('2026-09-01', { Stacco: [[110, 5]] })
    const squat = await session('2026-10-01', { Squat: [[85, 5]] })
    const panca = await session('2026-10-15', { 'Panca piana': [[65, 8]], Stacco: [[105, 3]] })
    const last = await session('2026-10-20', { 'Panca piana': [[70, 8]] })

    const { status, body } = await get<{ records: RecentRecord[] }>('/records')
    expect(status).toBe(200)
    expect(body.records.map((r) => [r.sessionId, r.exercise.name, r.kind])).toEqual([
      [last, 'Panca piana', 'e1rm'],
      [panca, 'Panca piana', 'e1rm'],
      [squat, 'Squat', 'e1rm'],
    ])
    expect(body.records[0]!.exercise.image).toMatchObject({ catalogId: 'Barbell_Bench_Press_-_Medium_Grip' })
    const more = await get<{ records: RecentRecord[] }>('/records?days=60&limit=10')
    expect(more.body.records.map((r) => r.exercise.name)).toEqual([
      'Panca piana',
      'Panca piana',
      'Squat',
      'Stacco',
    ])
  })

  it('parametri sbagliati rispondono 400', async () => {
    expect((await get('/records?days=0')).status).toBe(400)
    expect((await get('/records?limit=x')).status).toBe(400)
  })
})

describe('GET /exercises/{name} records', () => {
  it('porta i record di oggi con la data', async () => {
    await session('2026-10-01', { Squat: [[80, 5]] })
    const best = await session('2026-10-10', {
      Squat: [
        [90, 3],
        [80, 8],
      ],
    })
    const { body } = await get<ExerciseDetail>('/exercises/squat')
    const e1rm = body.records.find((r) => r.kind === 'e1rm')
    expect(e1rm).toMatchObject({ day: '2026-10-10', sessionId: best })
    expect(e1rm!.value).toBeCloseTo(101.33, 1)
    expect(body.records.find((r) => r.kind === 'reps' && r.weightKg === 80)).toMatchObject({ value: 8 })
  })
})

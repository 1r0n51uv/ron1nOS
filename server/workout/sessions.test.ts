// @vitest-environment node
// Storico delle sessioni (GYM-004) su un Postgres vero.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createApp } from '../app.ts'
import { testDb } from '../testing/db.ts'
import { fakeQbt } from '../testing/fake-qbt.ts'
import type { SessionRow } from './sessions.ts'

let db: Awaited<ReturnType<typeof testDb>>
beforeAll(async () => {
  db = await testDb()
})
afterAll(() => db.drop())
beforeEach(async () => {
  await db.query('truncate workout_sessions cascade')
})

async function session(day: string, routine: string, exercises: string[] = []) {
  const { rows } = await db.query<{ id: string }>(
    `insert into workout_sessions (day, routine, started_at, duration_seconds)
     values ($1::date, $2, ($1::text || ' 18:00')::timestamp at time zone 'Europe/Rome', 3000) returning id`,
    [day, routine],
  )
  for (const [i, name] of exercises.entries()) {
    for (const set of [1, 2]) {
      await db.query(
        `insert into workout_sets (session_id, exercise_name, exercise_key, exercise_order, set_index, weight_kg, reps)
         values ($1, $2, lower($2), $3, $4, 50, 8)`,
        [rows[0]!.id, name, i + 1, set],
      )
    }
  }
  return rows[0]!.id
}

async function get(path: string) {
  const res = await createApp({ qbt: fakeQbt(), database: { db, status: () => 'ok' } }).request(
    `/api/v1/workout${path}`,
  )
  return {
    status: res.status,
    body: (await res.json()) as { sessions: SessionRow[]; nextCursor: string | null },
  }
}

const day = (i: number) => new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10)

describe('GET /sessions', () => {
  it('dalla più recente, con i primi tre esercizi e le loro immagini', async () => {
    await session('2026-10-19', 'Gambe', ['Squat'])
    const id = await session('2026-10-21', 'Push', ['Panca piana', 'Croci', 'Esercizio mio', 'Dip'])
    const { body } = await get('/sessions')
    expect(body.nextCursor).toBeNull()
    expect(body.sessions.map((s) => s.routine)).toEqual(['Push', 'Gambe'])
    expect(body.sessions[0]).toMatchObject({ id, day: '2026-10-21', durationSeconds: 3000 })
    expect(body.sessions[0]!.exercises.map((e) => [e.name, e.image?.catalogId ?? null])).toEqual([
      ['Panca piana', 'Barbell_Bench_Press_-_Medium_Grip'],
      ['Croci', 'Dumbbell_Flyes'],
      ['Esercizio mio', null],
    ])
  })

  it('a pagine da 20 con il cursore', async () => {
    for (let i = 0; i < 25; i++) await session(day(i), 'Push')
    const first = await get('/sessions')
    expect(first.body.sessions).toHaveLength(20)
    expect(first.body.sessions[0]!.day).toBe(day(24))
    const second = await get(`/sessions?cursor=${first.body.nextCursor}`)
    expect(second.body.sessions.map((s) => s.day)).toEqual([day(4), day(3), day(2), day(1), day(0)])
    expect(second.body.nextCursor).toBeNull()
  })

  it('filtra per routine', async () => {
    await session('2026-10-19', 'Gambe')
    await session('2026-10-20', 'Push')
    await session('2026-10-21', 'Gambe')
    const { body } = await get('/sessions?routine=Gambe')
    expect(body.sessions.map((s) => s.day)).toEqual(['2026-10-21', '2026-10-19'])
  })

  it('un cursore non valido risponde 400', async () => {
    expect((await get('/sessions?cursor=abc')).status).toBe(400)
  })
})

describe('GET /routines', () => {
  it('i nomi dalla routine usata più di recente, senza quelli vuoti', async () => {
    await session('2026-10-19', 'Gambe')
    await session('2026-10-20', 'Push')
    await session('2026-10-21', '')
    const res = await createApp({ qbt: fakeQbt(), database: { db, status: () => 'ok' } }).request(
      '/api/v1/workout/routines',
    )
    expect(await res.json()).toEqual({ routines: ['Push', 'Gambe'] })
  })
})

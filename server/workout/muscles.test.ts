// @vitest-environment node
// Volume per gruppo muscolare (GYM-012) su un Postgres vero.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createApp } from '../app.ts'
import { testDb } from '../testing/db.ts'
import { fakeQbt } from '../testing/fake-qbt.ts'
import type { GroupWeek } from './muscles.ts'

let db: Awaited<ReturnType<typeof testDb>>
beforeAll(async () => {
  db = await testDb()
})
afterAll(() => db.drop())
beforeEach(async () => {
  await db.query('truncate workout_sessions, workout_exercises cascade')
})

type SetInput = [kg: number, reps: number | null, warmup?: boolean]

async function session(day: string, exercises: Record<string, SetInput[]>) {
  const { rows } = await db.query<{ id: string }>(
    `insert into workout_sessions (day, routine, started_at)
     values ($1::date, 'Push', ($1::text || ' 18:00')::timestamp at time zone 'Europe/Rome') returning id`,
    [day],
  )
  for (const [i, [name, sets]] of Object.entries(exercises).entries()) {
    for (const [j, [kg, reps, warmup = false]] of sets.entries()) {
      await db.query(
        `insert into workout_sets (session_id, exercise_name, exercise_key, exercise_order, set_index,
                                   is_warmup, weight_kg, reps, duration_seconds)
         values ($1, $2, lower($2), $3, $4, $5, $6, $7, $8)`,
        [rows[0]!.id, name, i + 1, j + 1, warmup, kg, reps, reps === null ? 60 : null],
      )
    }
  }
}

// Giovedì 22 ottobre 2026: la settimana corrente parte lunedì 19.
const NOW = new Date('2026-10-22T10:00:00Z')

async function get(path: string) {
  const res = await createApp({
    qbt: fakeQbt(),
    database: { db, status: () => 'ok' },
    workout: { now: () => NOW },
  }).request(`/api/v1/workout${path}`)
  return {
    status: res.status,
    body: (await res.json()) as { groups: (string | null)[]; weeks: GroupWeek[] },
  }
}

describe('GET /muscle-groups', () => {
  it('volume e serie per gruppo e settimana, Non assegnato a sé', async () => {
    await db.query(
      `insert into workout_exercises (exercise_key, muscle_group) values ('panca piana', 'petto'), ('squat', 'gambe')`,
    )
    // Fuori dalle 12 settimane.
    await session('2026-07-01', { Squat: [[100, 5]] })
    await session('2026-10-13', {
      Squat: [
        [80, 5],
        [80, 5],
      ],
    })
    await session('2026-10-20', {
      'Panca piana': [
        [40, 10, true],
        [60, 8],
      ],
      Squat: [[90, 3]],
      'Esercizio mio': [[10, 10]],
      Plank: [[0, null]],
    })

    const { status, body } = await get('/muscle-groups')
    expect(status).toBe(200)
    expect(body.weeks).toHaveLength(12)
    expect(body.weeks[0]!.monday).toBe('2026-08-03')
    expect(body.groups).toEqual(['petto', 'gambe', null])
    expect(body.weeks[10]).toEqual({
      monday: '2026-10-12',
      groups: [{ group: 'gambe', volumeKg: 800, sets: 2 }],
    })
    // Riscaldamento e serie a tempo esclusi.
    expect(body.weeks[11]).toEqual({
      monday: '2026-10-19',
      groups: [
        { group: 'petto', volumeKg: 480, sets: 1 },
        { group: 'gambe', volumeKg: 270, sets: 1 },
        { group: null, volumeKg: 100, sets: 1 },
      ],
    })
    expect(body.weeks[5]!.groups).toEqual([])
  })

  it('weeks cambia il periodo, fuori misura risponde 400', async () => {
    expect((await get('/muscle-groups?weeks=4')).body.weeks.map((w) => w.monday)).toEqual([
      '2026-09-28',
      '2026-10-05',
      '2026-10-12',
      '2026-10-19',
    ])
    expect((await get('/muscle-groups?weeks=0')).status).toBe(400)
  })
})

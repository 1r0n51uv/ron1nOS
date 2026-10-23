// @vitest-environment node
// Rotte di import del modulo Allenamento (GYM-003) su un Postgres vero.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createApp } from '../app.ts'
import { fakeQbt } from '../testing/fake-qbt.ts'
import { testDb } from '../testing/db.ts'

const HEADER = 'Date;Duration;Routine;Exercise;Set;Warmup;Weight;Reps/Time;Goal;Perception'
const CSV = [
  HEADER,
  '2026-10-19 18:00;3600;Push;Panca piana;1;1;40;10;;',
  '2026-10-19 18:00;3600;Push;Panca piana;2;0;80;6;;8',
  '2026-10-19 18:00;3600;Push;Croci;1;0;14;12;;',
  '2026-10-21 07:30;2700;Gambe;Squat;1;0;100;5;;',
  ';;;;;;;;;',
].join('\n')

let db: Awaited<ReturnType<typeof testDb>>
beforeAll(async () => {
  db = await testDb()
})
afterAll(() => db.drop())
beforeEach(async () => {
  await db.query('truncate workout_sessions, workout_sets, workout_deleted_sessions cascade')
})

const app = () => createApp({ qbt: fakeQbt(), database: { db, status: () => 'ok' } })

async function send(path: string, csv: string | Blob, name = 'liftin.csv') {
  const form = new FormData()
  form.append('file', csv instanceof Blob ? csv : new Blob([csv], { type: 'text/csv' }), name)
  const res = await app().request(`/api/v1/workout${path}`, { method: 'POST', body: form })
  return { status: res.status, body: (await res.json()) as Record<string, unknown> }
}

const count = async (table: string) =>
  Number((await db.query<{ n: number }>(`select count(*)::int as n from ${table}`)).rows[0]!.n)

describe('POST /import/preview', () => {
  it('conta senza scrivere', async () => {
    const { status, body } = await send('/import/preview', CSV)
    expect(status).toBe(200)
    expect(body).toEqual({
      newSessions: 2,
      updatedSessions: 0,
      unchangedSessions: 0,
      deletedSessions: 0,
      newSets: 4,
      updatedSets: 0,
      skippedRows: 1,
      from: '2026-10-19',
      to: '2026-10-21',
    })
    expect(await count('workout_sessions')).toBe(0)
  })

  it('errori in italiano', async () => {
    expect(await send('/import/preview', '')).toEqual({
      status: 400,
      body: { error: 'invalid_request', message: 'Il file è vuoto' },
    })
    expect((await send('/import/preview', 'Weight\n80')).body.message).toBe(
      'Colonne mancanti: Date, Exercise, Set',
    )
    const big = new Blob([HEADER, '\n', 'x'.repeat(5 * 1024 * 1024 + 10)])
    expect(await send('/import/preview', big)).toEqual({
      status: 400,
      body: { error: 'invalid_request', message: 'Il file supera i 5 MB' },
    })
  })

  it('senza file risponde 400', async () => {
    const res = await app().request('/api/v1/workout/import/preview', { method: 'POST' })
    expect(res.status).toBe(400)
  })

  it('senza database risponde 503', async () => {
    const res = await createApp({ qbt: fakeQbt() }).request('/api/v1/workout/import/preview', {
      method: 'POST',
    })
    expect(res.status).toBe(503)
  })
})

describe('POST /import', () => {
  it('crea sessioni e serie', async () => {
    const { body } = await send('/import', CSV)
    expect(body).toMatchObject({ newSessions: 2, newSets: 4 })
    const { rows } = await db.query(
      `select day, routine, started_at, duration_seconds from workout_sessions order by day`,
    )
    expect(rows).toEqual([
      {
        day: '2026-10-19',
        routine: 'Push',
        started_at: new Date('2026-10-19T16:00:00Z'),
        duration_seconds: 3600,
      },
      {
        day: '2026-10-21',
        routine: 'Gambe',
        started_at: new Date('2026-10-21T05:30:00Z'),
        duration_seconds: 2700,
      },
    ])
    const sets = await db.query(
      `select exercise_key, exercise_order, set_index, is_warmup, weight_kg, reps, perception
         from workout_sets order by exercise_order, set_index`,
    )
    expect(sets.rows.filter((s) => s.exercise_key !== 'squat')).toEqual([
      {
        exercise_key: 'panca piana',
        exercise_order: 1,
        set_index: 1,
        is_warmup: true,
        weight_kg: 40,
        reps: 10,
        perception: null,
      },
      {
        exercise_key: 'panca piana',
        exercise_order: 1,
        set_index: 2,
        is_warmup: false,
        weight_kg: 80,
        reps: 6,
        perception: 8,
      },
      {
        exercise_key: 'croci',
        exercise_order: 2,
        set_index: 1,
        is_warmup: false,
        weight_kg: 14,
        reps: 12,
        perception: null,
      },
    ])
  })

  it('un re-import identico non cambia nulla', async () => {
    await send('/import', CSV)
    const { body } = await send('/import', CSV)
    expect(body).toMatchObject({
      newSessions: 0,
      updatedSessions: 0,
      unchangedSessions: 2,
      newSets: 0,
      updatedSets: 0,
    })
    expect(await count('workout_sets')).toBe(4)
  })

  it('un re-import aggiorna e aggiunge senza duplicare, a meno di maiuscole e spazi', async () => {
    await send('/import', CSV)
    const next = [
      HEADER,
      '2026-10-19 18:00;3900;Push;PANCA  piana ;2;0;82,5;6;;8',
      '2026-10-19 18:00;3900;Push;Panca piana;3;0;80;5;;',
      '2026-10-22 18:00;;Pull;Trazioni;1;0;0;8;;',
    ].join('\n')
    expect((await send('/import/preview', next)).body).toMatchObject({
      newSessions: 1,
      updatedSessions: 1,
      newSets: 2,
      updatedSets: 1,
      from: '2026-10-19',
      to: '2026-10-22',
    })
    await send('/import', next)
    expect(await count('workout_sessions')).toBe(3)
    expect(await count('workout_sets')).toBe(6)
    const { rows } = await db.query(
      `select s.duration_seconds, w.weight_kg from workout_sets w join workout_sessions s on s.id = w.session_id
        where w.exercise_key = 'panca piana' and w.set_index = 2`,
    )
    expect(rows).toEqual([{ duration_seconds: 3900, weight_kg: 82.5 }])
  })

  it('le sessioni eliminate non tornano', async () => {
    await db.query(`insert into workout_deleted_sessions (day, routine) values ('2026-10-19', 'Push')`)
    const { body } = await send('/import', CSV)
    expect(body).toMatchObject({ newSessions: 1, deletedSessions: 1, newSets: 1 })
    const { rows } = await db.query(`select routine from workout_sessions`)
    expect(rows).toEqual([{ routine: 'Gambe' }])
  })
})

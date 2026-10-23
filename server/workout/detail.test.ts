// @vitest-environment node
// Dettaglio ed eliminazione di una sessione (GYM-005, GYM-006).
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createApp } from '../app.ts'
import { testDb } from '../testing/db.ts'
import { fakeQbt } from '../testing/fake-qbt.ts'
import type { SessionDetail } from './detail.ts'

let db: Awaited<ReturnType<typeof testDb>>
beforeAll(async () => {
  db = await testDb()
})
afterAll(() => db.drop())
beforeEach(async () => {
  await db.query('truncate workout_sessions, workout_deleted_sessions cascade')
})

const app = () => createApp({ qbt: fakeQbt(), database: { db, status: () => 'ok' } })

const HEADER = 'Date;Duration;Routine;Exercise;Set;Warmup;Weight;Reps/Time;Goal;Perception'

async function importCsv(lines: string[]) {
  const form = new FormData()
  form.append('file', new Blob([[HEADER, ...lines].join('\n')]), 'liftin.csv')
  const res = await app().request('/api/v1/workout/import', { method: 'POST', body: form })
  expect(res.status).toBe(200)
}

async function sessionId(day: string) {
  const { rows } = await db.query<{ id: string }>(`select id from workout_sessions where day = $1`, [day])
  return rows[0]!.id
}

describe('GET /sessions/{id}', () => {
  it('esercizi nell ordine del CSV, volume senza riscaldamento, record e serie a tempo', async () => {
    await importCsv([
      '2026-10-14 18:00;3600;Push;Panca piana;1;0;80;6;;',
      '2026-10-21 18:00;3900;Push;Panca piana;1;1;40;10;;',
      '2026-10-21 18:00;3900;Push;Panca piana;2;0;85;6;;',
      '2026-10-21 18:00;3900;Push;Panca piana;3;0;85;5;;',
      '2026-10-21 18:00;3900;Push;Croci;1;0;14;12;;',
      '2026-10-21 18:00;3900;Push;Plank;1;0;0;1:00;;',
    ])
    const id = await sessionId('2026-10-21')
    const res = await app().request(`/api/v1/workout/sessions/${id}`)
    const s = (await res.json()) as SessionDetail
    expect(s).toMatchObject({ id, day: '2026-10-21', routine: 'Push', durationSeconds: 3900 })
    expect(s.volumeKg).toBe(85 * 6 + 85 * 5 + 14 * 12)
    expect(s.exercises.map((e) => [e.name, e.volumeKg, e.record, e.timed])).toEqual([
      ['Panca piana', 935, true, false],
      ['Croci', 168, true, false],
      ['Plank', 0, false, true],
    ])
    expect(s.exercises[0]!.sets[0]).toEqual({
      index: 1,
      warmup: true,
      weightKg: 40,
      reps: 10,
      durationSeconds: null,
    })
    expect(s.exercises[0]!.image?.catalogId).toBe('Barbell_Bench_Press_-_Medium_Grip')
    expect(s.exercises[2]!.sets[0]).toMatchObject({ reps: null, durationSeconds: 60 })
  })

  it('nessun record se una sessione precedente era più forte', async () => {
    await importCsv([
      '2026-10-14 18:00;;Push;Panca piana;1;0;100;5;;',
      '2026-10-21 18:00;;Push;Panca piana;1;0;80;6;;',
    ])
    const res = await app().request(`/api/v1/workout/sessions/${await sessionId('2026-10-21')}`)
    expect(((await res.json()) as SessionDetail).exercises[0]!.record).toBe(false)
  })

  it('404 per una sessione che non c è, 400 per un id non valido', async () => {
    expect(
      (await app().request('/api/v1/workout/sessions/00000000-0000-4000-8000-000000000000')).status,
    ).toBe(404)
    expect((await app().request('/api/v1/workout/sessions/abc')).status).toBe(400)
  })
})

describe('DELETE /sessions/{id}', () => {
  it('toglie la sessione e un re-import non la riporta', async () => {
    const lines = [
      '2026-10-21 18:00;;Push;Panca piana;1;0;80;6;;',
      '2026-10-22 18:00;;Gambe;Squat;1;0;100;5;;',
    ]
    await importCsv(lines)
    const id = await sessionId('2026-10-21')
    const res = await app().request(`/api/v1/workout/sessions/${id}`, { method: 'DELETE' })
    expect(res.status).toBe(204)
    expect((await app().request(`/api/v1/workout/sessions/${id}`, { method: 'DELETE' })).status).toBe(404)

    await importCsv(lines)
    const { rows } = await db.query(`select day, routine from workout_sessions`)
    expect(rows).toEqual([{ day: '2026-10-22', routine: 'Gambe' }])
    expect(await db.query(`select 1 from workout_sets`)).toMatchObject({ rowCount: 1 })
  })
})

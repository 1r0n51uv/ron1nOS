// @vitest-environment node
// Lo schema del modulo Allenamento (migrazione 0010) su un Postgres vero.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { testDb } from '../testing/db.ts'

describe('schema Allenamento', () => {
  let db: Awaited<ReturnType<typeof testDb>>
  beforeAll(async () => {
    db = await testDb()
  })
  afterAll(() => db.drop())

  async function session(day: string, routine = 'Push') {
    const { rows } = await db.query<{ id: string }>(
      `insert into workout_sessions (day, routine, started_at) values ($1, $2, $3) returning id`,
      [day, routine, `${day}T18:00:00+02:00`],
    )
    return rows[0]!.id
  }

  it('crea le quattro tabelle', async () => {
    const { rows } = await db.query<{ table_name: string }>(
      `select table_name from information_schema.tables where table_schema = $1 and table_name like 'workout_%' order by 1`,
      [db.schema],
    )
    expect(rows.map((r) => r.table_name)).toEqual([
      'workout_deleted_sessions',
      'workout_exercises',
      'workout_sessions',
      'workout_sets',
    ])
  })

  it('una sessione è unica per giorno e routine', async () => {
    await session('2026-10-20')
    await session('2026-10-20', 'Pull')
    await expect(session('2026-10-20')).rejects.toThrow()
  })

  it('una serie è unica per sessione, esercizio e numero, e sparisce con la sessione', async () => {
    const id = await session('2026-10-21')
    const insert = (index: number) =>
      db.query(
        `insert into workout_sets (session_id, exercise_name, exercise_key, exercise_order, set_index, weight_kg, reps)
         values ($1, 'Panca piana', 'panca piana', 1, $2, 80, 6)`,
        [id, index],
      )
    await insert(1)
    await insert(2)
    await expect(insert(1)).rejects.toThrow()
    await db.query(`delete from workout_sessions where id = $1`, [id])
    const { rows } = await db.query(`select 1 from workout_sets where session_id = $1`, [id])
    expect(rows).toHaveLength(0)
  })

  it('il gruppo muscolare viene dall elenco fisso', async () => {
    await db.query(`insert into workout_exercises (exercise_key, muscle_group) values ('squat', 'gambe')`)
    await expect(
      db.query(`insert into workout_exercises (exercise_key, muscle_group) values ('curl', 'braccia')`),
    ).rejects.toThrow()
  })
})

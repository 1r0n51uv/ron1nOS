// @vitest-environment node
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { createDb, DatabaseUnavailableError, migrate, startDatabase } from './db.ts'
import { testDb } from './testing/db.ts'

describe('migrazioni', () => {
  let db: Awaited<ReturnType<typeof testDb>>
  beforeAll(async () => {
    db = await testDb()
  })
  afterAll(() => db.drop())

  it('la prima migrazione crea le tabelle del modulo Nutrizione', async () => {
    const { rows } = await db.query<{ table_name: string }>(
      `select table_name from information_schema.tables where table_schema = $1 order by 1`,
      [db.schema],
    )
    expect(rows.map((r) => r.table_name)).toEqual(
      expect.arrayContaining([
        'body_weights',
        'caffeine_logs',
        'diet_template_items',
        'diet_templates',
        'foods',
        'meal_entries',
        'meal_entry_items',
        'nutrition_goals',
        'planned_meal_items',
        'planned_meals',
        'recipe_items',
        'recipes',
        'schema_migrations',
        'shopping_list_items',
        'supplement_logs',
        'supplements',
        'water_logs',
      ]),
    )
  })

  it('rilanciare non rifà nulla', async () => {
    expect(await migrate(db)).toEqual([])
    const { rows } = await db.query('select name from schema_migrations')
    expect(rows).toContainEqual({ name: '0001_nutrition.sql' })
  })

  it('gli slot sono 5, senza snack', async () => {
    const { rows } = await db.query<{ slot: string }>(
      `select unnest(enum_range(null::meal_slot))::text as slot`,
    )
    expect(rows.map((r) => r.slot)).toEqual([
      'breakfast',
      'morning_snack',
      'lunch',
      'afternoon_snack',
      'dinner',
    ])
  })

  it('una cella del template ha una ricetta o un alimento, mai entrambi', async () => {
    const t = await db.query<{ id: string }>(
      `insert into diet_templates (name) values ('massa') returning id`,
    )
    const f = await db.query<{ id: string }>(
      `insert into foods (name, source, calories_per_100g) values ('Mela', 'custom', 52) returning id`,
    )
    const r = await db.query<{ id: string }>(`insert into recipes (name) values ('Pasta') returning id`)
    await expect(
      db.query(
        `insert into diet_template_items (template_id, weekday, slot, recipe_id, food_id, quantity_g)
         values ($1, 1, 'lunch', $2, $3, 100)`,
        [t.rows[0].id, r.rows[0].id, f.rows[0].id],
      ),
    ).rejects.toThrow()
    await db.query(
      `insert into diet_template_items (template_id, weekday, slot, food_id, quantity_g)
       values ($1, 1, 'lunch', $2, 180)`,
      [t.rows[0].id, f.rows[0].id],
    )
  })

  it('numeric e date tornano come numero e come YYYY-MM-DD', async () => {
    const { rows } = await db.query<{ n: number; d: string }>(
      `select 12.5::numeric as n, date '2026-10-22' as d`,
    )
    expect(rows[0]).toEqual({ n: 12.5, d: '2026-10-22' })
  })

  it('applica solo i file nuovi, in ordine', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mig-'))
    await writeFile(join(dir, '0002_b.sql'), 'create table b (id int)')
    await writeFile(join(dir, '0001_a.sql'), 'create table a (id int)')
    await writeFile(join(dir, 'note.txt'), 'non è una migrazione')
    const other = await testDb()
    try {
      const url = pathToFileURL(dir + '/')
      expect(await migrate(other, url)).toEqual(['0001_a.sql', '0002_b.sql'])
      await writeFile(join(dir, '0003_c.sql'), 'create table c (id int)')
      expect(await migrate(other, url)).toEqual(['0003_c.sql'])
    } finally {
      await other.drop()
    }
  })

  it('una migrazione che fallisce non lascia niente a metà', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mig-'))
    await writeFile(join(dir, '0001_a.sql'), 'create table a (id int)')
    await writeFile(join(dir, '0002_rotta.sql'), 'create table a (id int)')
    const other = await testDb()
    try {
      await expect(migrate(other, pathToFileURL(dir + '/'))).rejects.toThrow()
      const { rows } = await other.query(`select to_regclass('a') as t`)
      expect(rows[0]).toEqual({ t: null })
    } finally {
      await other.drop()
    }
  })
})

describe('createDb', () => {
  it('un Postgres irraggiungibile diventa DatabaseUnavailableError', async () => {
    const db = createDb('postgres://nessuno:x@127.0.0.1:1/ron1nos')
    await expect(db.query('select 1')).rejects.toBeInstanceOf(DatabaseUnavailableError)
    await expect(db.tx(async () => 1)).rejects.toBeInstanceOf(DatabaseUnavailableError)
    await db.end()
  })
})

describe('startDatabase', () => {
  it('senza database lo stato è disabled', async () => {
    const d = startDatabase(undefined)
    await d.ready
    expect(d.status()).toBe('disabled')
  })

  it('riprova finché Postgres non risponde, poi è ok', async () => {
    const real = await testDb()
    let calls = 0
    const flaky = {
      ...real,
      tx: ((fn) => {
        calls++
        return calls < 3 ? Promise.reject(new DatabaseUnavailableError('giù')) : real.tx(fn)
      }) as typeof real.tx,
    }
    const log = vi.fn()
    const d = startDatabase(flaky, { retryMs: 1, log })
    expect(d.status()).toBe('starting')
    await d.ready
    expect(d.status()).toBe('ok')
    expect(calls).toBe(3)
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/nuovo tentativo/))
    await real.drop()
  })
})

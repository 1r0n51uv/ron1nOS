// App del backend su un database di test, per i test delle rotte del
// modulo Nutrizione.
import type { createApp as CreateApp } from '../app.ts'
import { createApp } from '../app.ts'
import type { NutritionDeps } from '../nutrition/routes.ts'
import type { testDb } from './db.ts'
import { fakeQbt } from './fake-qbt.ts'

type TestDb = Awaited<ReturnType<typeof testDb>>

export function nutritionApp(db: TestDb, nutrition: Omit<NutritionDeps, 'database'> = {}) {
  const app: ReturnType<typeof CreateApp> = createApp({
    qbt: fakeQbt(),
    database: { db, status: () => 'ok' },
    nutrition,
  })
  const call = async (method: string, path: string, body?: unknown) => {
    const res = await app.request(`/api/v1/nutrition${path}`, {
      method,
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const text = await res.text()
    return { status: res.status, body: text ? JSON.parse(text) : null }
  }
  return {
    app,
    get: (path: string) => call('GET', path),
    post: (path: string, body?: unknown) => call('POST', path, body ?? {}),
    patch: (path: string, body: unknown) => call('PATCH', path, body),
    put: (path: string, body: unknown) => call('PUT', path, body),
    delete: (path: string) => call('DELETE', path),
  }
}

// Svuota le tabelle del modulo fra un test e l'altro.
export async function resetNutrition(db: TestDb) {
  const { rows } = await db.query<{ table_name: string }>(
    `select table_name from information_schema.tables
      where table_schema = $1 and table_type = 'BASE TABLE' and table_name <> 'schema_migrations'`,
    [db.schema],
  )
  await db.query(`truncate ${rows.map((r) => r.table_name).join(', ')} cascade`)
}

type Queryable = { query: TestDb['query'] }

export async function seedFood(
  db: Queryable,
  food: {
    name: string
    kcal: number
    protein?: number
    carbs?: number
    fat?: number
    caffeine?: number
  } & Record<string, unknown>,
) {
  const { rows } = await db.query<{ id: string }>(
    `insert into foods (name, source, calories_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g,
       caffeine_mg_per_100g, barcode, brand)
     values ($1, coalesce($2, 'custom'), $3, $4, $5, $6, $7, $8, $9) returning id`,
    [
      food.name,
      food.source ?? null,
      food.kcal,
      food.protein ?? 0,
      food.carbs ?? 0,
      food.fat ?? 0,
      food.caffeine ?? null,
      food.barcode ?? null,
      food.brand ?? null,
    ],
  )
  return rows[0].id
}

// Un pasto mangiato con le sue righe (kcal e macro già calcolati).
export async function seedMeal(
  db: Queryable,
  day: string,
  slot: string,
  items: {
    foodId?: string | null
    name: string
    grams: number
    kcal: number
    protein?: number
    carbs?: number
    fat?: number
  }[],
) {
  const { rows } = await db.query<{ id: string }>(
    `insert into meal_entries (day, slot) values ($1, $2)
     on conflict (day, slot) do update set day = excluded.day returning id`,
    [day, slot],
  )
  const ids: string[] = []
  for (const [i, it] of items.entries()) {
    const r = await db.query<{ id: string }>(
      `insert into meal_entry_items (meal_entry_id, food_id, food_name, quantity_g, calories, protein_g, carbs_g,
         fat_g, order_index)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id`,
      [
        rows[0].id,
        it.foodId ?? null,
        it.name,
        it.grams,
        it.kcal,
        it.protein ?? 0,
        it.carbs ?? 0,
        it.fat ?? 0,
        i,
      ],
    )
    ids.push(r.rows[0].id)
  }
  return { mealId: rows[0].id, itemIds: ids }
}

export async function seedPlanned(
  db: Queryable,
  day: string,
  slot: string,
  items: { foodId: string; name: string; grams: number }[],
  status = 'planned',
) {
  const { rows } = await db.query<{ id: string }>(
    `insert into planned_meals (day, slot, status) values ($1, $2, $3) returning id`,
    [day, slot, status],
  )
  for (const [i, it] of items.entries()) {
    await db.query(
      `insert into planned_meal_items (planned_meal_id, food_id, food_name, quantity_g, order_index)
       values ($1, $2, $3, $4, $5)`,
      [rows[0].id, it.foodId, it.name, it.grams, i],
    )
  }
  return rows[0].id
}

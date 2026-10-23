// Postgres degli e2e: lo stesso del backend sotto test. Ogni test del
// modulo Nutrizione parte con le tabelle vuote; le sessioni del login
// restano, così il cookie del setup vale per tutta la suite, e i tipi di
// documento già pronti pure.
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import pg from 'pg'

export const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? 'postgres://ron1nos:ron1nos@localhost:5432/ron1nos'

// Copia del catalogo delle immagini degli esercizi del backend sotto test.
export const E2E_CATALOG_DIR = join(tmpdir(), 'ron1nos-e2e-catalog')

export async function resetNutrition() {
  const client = new pg.Client({ connectionString: E2E_DATABASE_URL })
  await client.connect()
  try {
    const { rows } = await client.query<{ table_name: string }>(
      `select table_name from information_schema.tables
        where table_schema = 'public' and table_type = 'BASE TABLE'
          and table_name not in ('schema_migrations', 'auth_sessions', 'document_types')`,
    )
    if (rows.length) await client.query(`truncate ${rows.map((r) => r.table_name).join(', ')} cascade`)
  } finally {
    await client.end()
  }
}

// Query diretta, per preparare i dati di un test.
export async function sql(text: string, params: unknown[] = []) {
  const client = new pg.Client({ connectionString: E2E_DATABASE_URL })
  await client.connect()
  try {
    return (await client.query(text, params)).rows
  } finally {
    await client.end()
  }
}

export function todayRome() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' })
}

export function dayFromToday(n: number) {
  const d = new Date(`${todayRome()}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// Un pasto mangiato con kcal già calcolate.
export async function seedMeal(
  day: string,
  slot: string,
  items: { name: string; grams: number; kcal: number }[],
) {
  const [meal] = await sql(`insert into meal_entries (day, slot) values ($1, $2) returning id`, [day, slot])
  for (const [i, it] of items.entries()) {
    await sql(
      `insert into meal_entry_items (meal_entry_id, food_name, quantity_g, calories, order_index)
       values ($1, $2, $3, $4, $5)`,
      [meal.id, it.name, it.grams, it.kcal, i],
    )
  }
}

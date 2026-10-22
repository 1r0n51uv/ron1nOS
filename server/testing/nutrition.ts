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

// Postgres degli e2e: lo stesso del backend sotto test. Ogni test del
// modulo Nutrizione parte con le tabelle vuote.
import pg from 'pg'

export const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? 'postgres://ron1nos:ron1nos@localhost:5432/ron1nos'

export async function resetNutrition() {
  const client = new pg.Client({ connectionString: E2E_DATABASE_URL })
  await client.connect()
  try {
    const { rows } = await client.query<{ table_name: string }>(
      `select table_name from information_schema.tables
        where table_schema = 'public' and table_type = 'BASE TABLE' and table_name <> 'schema_migrations'`,
    )
    if (rows.length) await client.query(`truncate ${rows.map((r) => r.table_name).join(', ')} cascade`)
  } finally {
    await client.end()
  }
}

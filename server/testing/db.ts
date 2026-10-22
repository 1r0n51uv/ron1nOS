// Postgres vero per i test: ogni file di test lavora in uno schema suo,
// creato e migrato all'inizio e tolto alla fine. In CI il database è il
// servizio postgres del job; in locale basta un Postgres con lo stesso
// utente (vedi README, Sviluppo).
import { randomUUID } from 'node:crypto'

import type { Db } from '../db.ts'
import { createDb, migrate } from '../db.ts'

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://ron1nos:ron1nos@localhost:5432/ron1nos'

export async function testDb(): Promise<Db & { schema: string; drop(): Promise<void> }> {
  const schema = `t_${randomUUID().replaceAll('-', '').slice(0, 12)}`
  const admin = createDb(TEST_DATABASE_URL)
  await admin.query(`create schema ${schema}`)
  await admin.end()
  const db = createDb(TEST_DATABASE_URL, { schema })
  await migrate(db)
  return {
    ...db,
    schema,
    async drop() {
      await db.end()
      const admin = createDb(TEST_DATABASE_URL)
      await admin.query(`drop schema ${schema} cascade`)
      await admin.end()
    },
  }
}

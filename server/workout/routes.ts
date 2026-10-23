// Rotte del modulo Allenamento sotto /api/v1/workout (specifica
// docs/specs/workout.md, contratto in api/openapi.yaml).
import { Hono } from 'hono'
import type { Context } from 'hono'
import { bodyLimit } from 'hono/body-limit'

import type { Database, Db } from '../db.ts'
import { DatabaseUnavailableError } from '../db.ts'
import { InvalidRequestError } from '../nutrition/http.ts'
import { importLiftin } from './import.ts'
import { LiftinError, parseLiftin } from './liftin.ts'

type WorkoutDeps = { database: Database }

// Il CSV completo di Liftin' resta sotto i 5 MB anche dopo anni.
export const MAX_CSV_BYTES = 5 * 1024 * 1024

const csvLimit = bodyLimit({
  maxSize: MAX_CSV_BYTES + 64 * 1024,
  onError: () => {
    throw new LiftinError('Il file supera i 5 MB')
  },
})

// Il file arriva come multipart, campo `file`; il client non lo interpreta.
async function readCsv(c: Context) {
  const type = c.req.header('content-type') ?? ''
  if (!type.startsWith('multipart/form-data')) throw new InvalidRequestError('Carica un file CSV')
  const body = await c.req.parseBody().catch(() => {
    throw new InvalidRequestError('Carica un file CSV')
  })
  const file = body.file
  if (!(file instanceof File)) throw new InvalidRequestError('Carica un file CSV')
  if (file.size > MAX_CSV_BYTES) throw new LiftinError('Il file supera i 5 MB')
  return parseLiftin(await file.text())
}

export function workoutRoutes({ database }: WorkoutDeps) {
  const app = new Hono<{ Variables: { db: Db } }>()

  // Senza Postgres il modulo risponde 503; il resto della dashboard no.
  app.use('*', async (c, next) => {
    if (database.status() !== 'ok' || !database.db) throw new DatabaseUnavailableError('database non pronto')
    c.set('db', database.db)
    await next()
  })

  // Anteprima dell'import (GYM-003): stessi conti dell'import, nessuna scrittura.
  app.post('/import/preview', csvLimit, async (c) => {
    const parsed = await readCsv(c)
    return c.json(await importLiftin(c.get('db'), parsed, { apply: false }))
  })

  app.post('/import', csvLimit, async (c) => {
    const parsed = await readCsv(c)
    const summary = await c.get('db').tx(async (tx) => {
      // Due import insieme non devono creare la stessa sessione due volte.
      await tx.query('select pg_advisory_xact_lock(7210010)')
      return importLiftin(tx, parsed, { apply: true })
    })
    return c.json(summary)
  })

  return app
}

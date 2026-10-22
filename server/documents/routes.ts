// Rotte del modulo Documenti sotto /api/v1/documents (specifica
// docs/specs/documents.md, contratto in api/openapi.yaml). Il modulo parte
// solo con il login acceso e DOCUMENTS_KEY: senza, risponde 503.
import { Hono } from 'hono'

import type { Database, Db } from '../db.ts'
import { DatabaseUnavailableError } from '../db.ts'
import type { Vault } from './crypto.ts'
import { listTypes } from './types.ts'

export type DocumentsDeps = {
  database: Database
  // undefined = DOCUMENTS_KEY mancante o non valida.
  vault?: Vault
  // Il modulo non parte senza login (docs/specs/auth.md).
  authEnabled: boolean
}

export class DocumentsDisabledError extends Error {}

export function documentsRoutes({ database, vault, authEnabled }: DocumentsDeps) {
  const routes = new Hono()

  const ready = (): { db: Db; vault: Vault } => {
    if (!authEnabled || !vault) {
      throw new DocumentsDisabledError(
        !authEnabled ? 'Il modulo Documenti richiede il login' : 'DOCUMENTS_KEY mancante o non valida',
      )
    }
    if (!database.db || database.status() !== 'ok') throw new DatabaseUnavailableError('database non pronto')
    return { db: database.db, vault }
  }

  routes.get('/types', async (c) => c.json(await listTypes(ready().db)))

  return routes
}

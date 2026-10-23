// Rotte delle preferenze sotto /api/v1/preferences (docs/specs/settings.md).
import { Hono } from 'hono'

import type { Database } from '../db.ts'
import { DatabaseUnavailableError } from '../db.ts'
import { check, readJson } from '../nutrition/http.ts'
import { applyPatch, DEFAULT_PREFERENCES, Preferences, PreferencesPatch } from './schema.ts'
import { getPreferences, patchPreferences } from './store.ts'

export function preferencesRoutes({ database }: { database: Database }) {
  const app = new Hono()

  // Senza database valgono i predefiniti: `stored: false` dice al client di avvisare.
  app.get('/', async (c) => {
    if (database.status() !== 'ok' || !database.db) {
      return c.json({ ...DEFAULT_PREFERENCES, updatedAt: null, stored: false })
    }
    return c.json({ ...(await getPreferences(database.db)), stored: true })
  })

  app.patch('/', async (c) => {
    const patch = await readJson(c, PreferencesPatch)
    // La forma si controlla anche senza database, come per il layout.
    check(Preferences, applyPatch(DEFAULT_PREFERENCES, patch))
    if (database.status() !== 'ok' || !database.db) throw new DatabaseUnavailableError('database non pronto')
    return c.json({ ...(await patchPreferences(database.db, patch)), stored: true })
  })

  return app
}

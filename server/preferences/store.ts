import type { Queryable } from '../db.ts'
import type { Preferences, PreferencesPatch } from './schema.ts'
import { applyPatch, DEFAULT_PREFERENCES, normalize } from './schema.ts'

export type StoredPreferences = Preferences & { updatedAt: string | null }

export async function getPreferences(db: Queryable): Promise<StoredPreferences> {
  const { rows } = await db.query<{ data: unknown; updatedAt: Date }>(
    'select data, updated_at as "updatedAt" from preferences where id',
  )
  const row = rows[0]
  if (!row) return { ...DEFAULT_PREFERENCES, updatedAt: null }
  return { ...normalize(row.data), updatedAt: row.updatedAt.toISOString() }
}

// Un solo utente: leggere, unire e riscrivere basta, senza transazione.
export async function patchPreferences(db: Queryable, patch: PreferencesPatch): Promise<StoredPreferences> {
  const current = await getPreferences(db)
  const next = applyPatch(current, patch)
  const { rows } = await db.query<{ updatedAt: Date }>(
    `insert into preferences (id, data) values (true, $1)
     on conflict (id) do update set data = excluded.data, updated_at = now()
     returning updated_at as "updatedAt"`,
    [JSON.stringify(next)],
  )
  return { ...next, updatedAt: rows[0].updatedAt.toISOString() }
}

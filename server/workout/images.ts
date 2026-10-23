// L'immagine di ogni esercizio (GYM-014): la scelta fatta a mano, se c'è,
// poi il dizionario dei nomi italiani, poi un nome inglese identico a uno
// del catalogo. La scelta sta in workout_exercises per nome normalizzato,
// così vale per tutto lo storico e sopravvive ai re-import.
import type { Queryable } from '../db.ts'
import type { Catalog } from './catalog.ts'
import { DICTIONARY } from './dictionary.ts'

export type ExerciseImage = {
  catalogId: string
  source: 'manual' | 'dictionary' | 'catalog'
  url: string
}

export function imageUrl(catalogId: string, n = 0) {
  return `/api/v1/workout/catalog/images/${encodeURIComponent(catalogId)}/${n}.jpg`
}

export async function exerciseImages(
  db: Queryable,
  catalog: Catalog | undefined,
  keys: string[],
): Promise<Map<string, ExerciseImage | null>> {
  const { rows } = await db.query<{ exercise_key: string; catalog_id: string }>(
    `select exercise_key, catalog_id from workout_exercises
      where exercise_key = any($1::text[]) and catalog_id is not null`,
    [keys],
  )
  const manual = new Map(rows.map((r) => [r.exercise_key, r.catalog_id]))
  const known = (id: string | undefined) => (id && (!catalog || catalog.get(id)) ? id : undefined)
  return new Map<string, ExerciseImage | null>(
    keys.map((key): [string, ExerciseImage | null] => {
      const chosen = known(manual.get(key))
      if (chosen) return [key, { catalogId: chosen, source: 'manual', url: imageUrl(chosen) }]
      const fromDictionary = known(DICTIONARY.get(key))
      if (fromDictionary)
        return [key, { catalogId: fromDictionary, source: 'dictionary', url: imageUrl(fromDictionary) }]
      const sameName = catalog?.byName(key)?.id
      if (sameName) return [key, { catalogId: sameName, source: 'catalog', url: imageUrl(sameName) }]
      return [key, null]
    }),
  )
}

// La scelta a mano; null torna all'abbinamento automatico.
export async function setExerciseImage(db: Queryable, key: string, catalogId: string | null) {
  await db.query(
    `insert into workout_exercises (exercise_key, catalog_id) values ($1, $2)
     on conflict (exercise_key) do update set catalog_id = excluded.catalog_id, updated_at = now()`,
    [key, catalogId],
  )
}

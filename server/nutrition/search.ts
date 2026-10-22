// Ricerca alimenti su tutte le fonti (NUT-004): catalogo locale, poi
// OpenFoodFacts, poi USDA (e YAZIO con NUT-021), senza doppioni per nome.
import type { Queryable } from '../db.ts'
import type { Food, FoodCandidate } from './foods.ts'
import { FOOD_COLUMNS, normalizeName, searchLocal } from './foods.ts'
import type { ExternalSearch } from './foodsearch.ts'

export type SearchResult = FoodCandidate & { id: string | null; yazioProductId: string | null }

export type SearchSource = 'openfoodfacts' | 'usda' | 'yazio'

export type SearchDeps = {
  db: Queryable
  external: ExternalSearch
  // Fonti in più, in coda (NUT-021).
  extra?: { source: SearchSource; search: (q: string) => Promise<FoodCandidate[] | null> }[]
}

export async function searchFoods(
  { db, external, extra = [] }: SearchDeps,
  q: string,
  { italy = true, limit = 30 }: { italy?: boolean; limit?: number } = {},
): Promise<{ results: SearchResult[]; unavailable: SearchSource[] }> {
  const query = q.trim()
  if (query.length < 2) return { results: [], unavailable: [] }

  const [local, off, usda, ...more] = await Promise.all([
    searchLocal(db, query, 10),
    external.off(query, { limit: 20, italy }),
    external.usda(query, { limit: 10 }),
    ...extra.map((e) => e.search(query)),
  ])

  const unavailable: SearchSource[] = []
  if (off === null) unavailable.push('openfoodfacts')
  if (usda === null) unavailable.push('usda')
  more.forEach((r, i) => r === null && unavailable.push(extra[i].source))

  const seenNames = new Set<string>()
  const seenIds = new Set<string>()
  const results: SearchResult[] = []
  const add = (r: SearchResult) => {
    const name = `${normalizeName(r.name)}|${normalizeName(r.brand ?? '')}`
    const ext = r.externalId ? `${r.source}:${r.externalId}` : null
    if (seenNames.has(name) || (ext && seenIds.has(ext))) return
    seenNames.add(name)
    if (ext) seenIds.add(ext)
    results.push(r)
  }
  local.forEach((f: Food) => add(f))
  for (const list of [off ?? [], usda ?? [], ...more.map((m) => m ?? [])]) {
    for (const c of list) add({ ...c, id: null, yazioProductId: c.yazioProductId ?? null })
  }
  return { results: results.slice(0, limit), unavailable }
}

// Codice a barre (NUT-005): prima il catalogo locale, poi OpenFoodFacts.
// Un prodotto esterno non entra nel catalogo finché non lo si usa.
export async function findBarcode(
  { db, external }: Pick<SearchDeps, 'db' | 'external'>,
  code: string,
): Promise<{ food: SearchResult | null; unavailable: SearchSource[] }> {
  const { rows } = await db.query<Food>(`select ${FOOD_COLUMNS} from foods where barcode = $1`, [code])
  if (rows[0]) return { food: rows[0], unavailable: [] }
  const off = await external.offBarcode(code)
  if (off === undefined) return { food: null, unavailable: ['openfoodfacts'] }
  return {
    food: off ? { ...off, id: null, yazioProductId: off.yazioProductId ?? null } : null,
    unavailable: [],
  }
}

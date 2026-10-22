// Catalogo degli alimenti (NUT-004, NUT-006): quelli già usati o creati a
// mano stanno in `foods`; un risultato esterno ci entra solo quando lo si
// usa (ensureFood), con la sua fonte e il suo id esterno.
import type { Queryable } from '../db.ts'

export type FoodSource = 'custom' | 'openfoodfacts' | 'usda' | 'yazio'

// Valori per 100 g. `id` c'è solo per gli alimenti già nel catalogo.
export type Food = {
  id: string | null
  source: FoodSource
  externalId: string | null
  name: string
  brand: string | null
  barcode: string | null
  servingSizeG: number | null
  kcal: number
  protein: number
  carbs: number
  fat: number
  caffeineMg: number | null
  yazioProductId: string | null
}

export type FoodCandidate = Omit<Food, 'id' | 'yazioProductId'> & { yazioProductId?: string | null }

export const FOOD_COLUMNS = `id, source, external_id as "externalId", name, brand, barcode,
  serving_size_g as "servingSizeG", calories_per_100g as kcal, protein_g_per_100g as protein,
  carbs_g_per_100g as carbs, fat_g_per_100g as fat, caffeine_mg_per_100g as "caffeineMg",
  yazio_product_id as "yazioProductId"`

export async function getFood(db: Queryable, id: string): Promise<Food | null> {
  const { rows } = await db.query<Food>(`select ${FOOD_COLUMNS} from foods where id = $1`, [id])
  return rows[0] ?? null
}

// Ricerca nel catalogo locale: parole del nome o della marca, prima chi
// inizia con la ricerca.
export async function searchLocal(db: Queryable, q: string, limit = 10): Promise<Food[]> {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const params: unknown[] = []
  const conds = words.map((w) => {
    params.push(`%${w.replace(/[\\%_]/g, (m) => `\\${m}`)}%`)
    return `(lower(name) like $${params.length} or lower(coalesce(brand, '')) like $${params.length})`
  })
  params.push(`${words.join(' ')}%`, limit)
  const { rows } = await db.query<Food>(
    `select ${FOOD_COLUMNS} from foods where ${conds.join(' and ')}
      order by (lower(name) like $${params.length - 1}) desc, length(name), name limit $${params.length}`,
    params,
  )
  return rows
}

// Un candidato esterno entra nel catalogo quando lo si usa: se c'è già
// (stessa fonte e id, o stesso codice a barre) si riusa quello.
export async function ensureFood(db: Queryable, c: FoodCandidate): Promise<Food> {
  if (c.externalId) {
    const { rows } = await db.query<Food>(
      `select ${FOOD_COLUMNS} from foods where source = $1 and external_id = $2`,
      [c.source, c.externalId],
    )
    if (rows[0]) return rows[0]
  }
  if (c.barcode) {
    const { rows } = await db.query<Food>(`select ${FOOD_COLUMNS} from foods where barcode = $1`, [c.barcode])
    if (rows[0]) return rows[0]
  }
  const { rows } = await db.query<Food>(
    `insert into foods (name, source, external_id, barcode, brand, serving_size_g, calories_per_100g,
       protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g, caffeine_mg_per_100g, yazio_product_id,
       yazio_matched_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) returning ${FOOD_COLUMNS}`,
    [
      c.name,
      c.source,
      c.externalId,
      c.barcode,
      c.brand,
      c.servingSizeG,
      c.kcal,
      c.protein,
      c.carbs,
      c.fat,
      c.caffeineMg,
      c.yazioProductId ?? null,
      c.yazioProductId ? 'source' : null,
    ],
  )
  return rows[0]
}

export function normalizeName(name: string) {
  return name.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, ' ').trim()
}

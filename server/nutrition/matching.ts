// Alimenti senza equivalente YAZIO (NUT-023): restano nel diario di
// ron1nOS e si abbinano a mano a un prodotto YAZIO, oppure si lasciano
// solo qui. L'abbinamento si salva sull'alimento e vale anche dopo.
import type { Queryable } from '../db.ts'
import type { FoodSource } from './foods.ts'
import { NotFoundError } from './http.ts'
import type { Slot } from './schemas.ts'

export type Unmatched = {
  food: { id: string; name: string; brand: string | null; source: FoodSource; kcal: number }
  rows: number
  // L'ultima volta che è stato registrato.
  last: { day: string; slot: Slot; grams: number }
}

export async function listUnmatched(db: Queryable): Promise<Unmatched[]> {
  const { rows } = await db.query<{
    id: string
    name: string
    brand: string | null
    source: FoodSource
    kcal: number
    rows: number
    day: string
    slot: Slot
    grams: number
  }>(
    `select f.id, f.name, f.brand, f.source, f.calories_per_100g as kcal, u.rows, u.day, u.slot, u.grams
       from foods f
       join lateral (
         select count(*) over ()::int as rows, e.day, e.slot, i.quantity_g as grams
           from meal_entry_items i join meal_entries e on e.id = i.meal_entry_id
          where i.food_id = f.id and i.yazio_sync = 'unmatched'
          order by e.day desc, i.created_at desc limit 1
       ) u on true
      where f.yazio_matched_by is distinct from 'local'
      order by u.day desc, f.name`,
  )
  return rows.map(({ id, name, brand, source, kcal, rows: n, day, slot, grams }) => ({
    food: { id, name, brand, source, kcal },
    rows: n,
    last: { day, slot, grams },
  }))
}

export async function countUnmatched(db: Queryable) {
  const { rows } = await db.query<{ n: number }>(
    `select count(distinct i.food_id)::int as n
       from meal_entry_items i join foods f on f.id = i.food_id
      where i.yazio_sync = 'unmatched' and f.yazio_matched_by is distinct from 'local'`,
  )
  return rows[0].n
}

// Con un prodotto le righe tornano in coda e partono al prossimo invio;
// con null l'alimento resta solo in ron1nOS.
export async function setEquivalent(db: Queryable, foodId: string, productId: string | null) {
  const { rowCount } = await db.query(
    `update foods set yazio_product_id = $2, yazio_matched_by = $3, updated_at = now() where id = $1`,
    [foodId, productId, productId ? 'manual' : 'local'],
  )
  if (!rowCount) throw new NotFoundError('Alimento non trovato')
  await db.query(
    `update meal_entry_items set yazio_sync = 'local' where food_id = $1 and yazio_sync in ('unmatched', 'error')`,
    [foodId],
  )
}

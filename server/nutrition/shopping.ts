// Lista della spesa (NUT-011): voci generate dai pasti pianificati di un
// intervallo, sommando i grammi dello stesso alimento, e voci a mano.
// Rigenerare aggiunge solo ciò che manca (DietSync.generateShoppingList di
// 1r0-pkm).
import type { Queryable } from '../db.ts'
import { normalizeName } from './foods.ts'
import { NotFoundError } from './http.ts'

export type ShoppingItem = {
  id: string
  foodId: string | null
  name: string
  grams: number | null
  text: string | null
  checked: boolean
  source: 'generated' | 'manual'
}

const COLUMNS = `id, food_id as "foodId", name, quantity_g as grams, quantity_text as text,
  is_checked as checked, source`

export async function listShopping(db: Queryable): Promise<ShoppingItem[]> {
  const { rows } = await db.query<ShoppingItem>(
    `select ${COLUMNS} from shopping_list_items order by source, lower(name), id`,
  )
  return rows
}

// Dai pasti non saltati fra `from` e `to`: un alimento già in lista (per id
// o per nome) non si aggiunge di nuovo.
export async function generateShopping(db: Queryable, from: string, to: string) {
  const { rows: needed } = await db.query<{ foodId: string | null; name: string; grams: number }>(
    `select pi.food_id as "foodId", min(pi.food_name) as name, sum(pi.quantity_g) as grams
       from planned_meal_items pi join planned_meals p on p.id = pi.planned_meal_id
      where p.day between $1 and $2 and p.status <> 'skipped'
      group by coalesce(pi.food_id::text, lower(pi.food_name)), pi.food_id
      order by min(p.day), min(pi.order_index)`,
    [from, to],
  )
  const existing = await listShopping(db)
  const haveIds = new Set(existing.flatMap((i) => (i.foodId ? [i.foodId] : [])))
  const haveNames = new Set(existing.map((i) => normalizeName(i.name)))
  let added = 0
  for (const n of needed) {
    if ((n.foodId && haveIds.has(n.foodId)) || haveNames.has(normalizeName(n.name))) continue
    await db.query(
      `insert into shopping_list_items (food_id, name, quantity_g, source) values ($1, $2, $3, 'generated')`,
      [n.foodId, n.name, n.grams],
    )
    haveNames.add(normalizeName(n.name))
    added++
  }
  return added
}

export async function addShopping(db: Queryable, { name, text }: { name: string; text: string | null }) {
  const { rows } = await db.query<ShoppingItem>(
    `insert into shopping_list_items (name, quantity_text, source) values ($1, $2, 'manual') returning ${COLUMNS}`,
    [name, text],
  )
  return rows[0]
}

export async function updateShopping(
  db: Queryable,
  id: string,
  patch: { checked?: boolean; name?: string; text?: string | null },
) {
  const { rows } = await db.query<ShoppingItem>(
    `update shopping_list_items set is_checked = coalesce($2, is_checked), name = coalesce($3, name),
       quantity_text = case when $5 then $4 else quantity_text end
      where id = $1 returning ${COLUMNS}`,
    [id, patch.checked ?? null, patch.name ?? null, patch.text ?? null, 'text' in patch],
  )
  if (!rows[0]) throw new NotFoundError('Voce non trovata')
  return rows[0]
}

export async function deleteShopping(db: Queryable, id: string) {
  const { rowCount } = await db.query('delete from shopping_list_items where id = $1', [id])
  if (!rowCount) throw new NotFoundError('Voce non trovata')
}

// Togli le spuntate.
export async function clearChecked(db: Queryable) {
  const { rowCount } = await db.query('delete from shopping_list_items where is_checked')
  return rowCount ?? 0
}

// Alimenti personali (NUT-006): creati a mano, si modificano e si
// eliminano. I pasti già registrati tengono i valori copiati (NUT-003) e
// perdono solo il collegamento all'alimento.
import type { Queryable } from '../db.ts'
import type { Food } from './foods.ts'
import { FOOD_COLUMNS, getFood } from './foods.ts'
import { ConflictError, NotFoundError } from './http.ts'

export type CustomFood = {
  name: string
  brand: string | null
  barcode: string | null
  servingSizeG: number | null
  kcal: number
  protein: number
  carbs: number
  fat: number
  caffeineMg: number | null
}

const COLUMNS = {
  name: 'name',
  brand: 'brand',
  barcode: 'barcode',
  servingSizeG: 'serving_size_g',
  kcal: 'calories_per_100g',
  protein: 'protein_g_per_100g',
  carbs: 'carbs_g_per_100g',
  fat: 'fat_g_per_100g',
  caffeineMg: 'caffeine_mg_per_100g',
} as const satisfies Record<keyof CustomFood, string>

// Il codice a barre è unico nel catalogo: un doppione è un 409.
async function unique<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (err) {
    if ((err as { code?: string }).code === '23505') {
      throw new ConflictError('barcode_exists', 'Questo codice a barre è già di un altro alimento')
    }
    throw err
  }
}

export async function listCustom(db: Queryable): Promise<Food[]> {
  const { rows } = await db.query<Food>(
    `select ${FOOD_COLUMNS} from foods where source = 'custom' order by lower(name), id`,
  )
  return rows
}

export async function createCustom(db: Queryable, f: CustomFood): Promise<Food> {
  const keys = Object.keys(COLUMNS) as (keyof CustomFood)[]
  const { rows } = await unique(() =>
    db.query<Food>(
      `insert into foods (source, ${keys.map((k) => COLUMNS[k]).join(', ')})
       values ('custom', ${keys.map((_, i) => `$${i + 1}`).join(', ')}) returning ${FOOD_COLUMNS}`,
      keys.map((k) => f[k]),
    ),
  )
  return rows[0]
}

async function customOrThrow(db: Queryable, id: string) {
  const food = await getFood(db, id)
  if (!food) throw new NotFoundError('Alimento non trovato')
  if (food.source !== 'custom') {
    throw new ConflictError('food_not_custom', 'Si modificano solo gli alimenti personali')
  }
  return food
}

export async function updateCustom(db: Queryable, id: string, patch: Partial<CustomFood>): Promise<Food> {
  await customOrThrow(db, id)
  const keys = (Object.keys(patch) as (keyof CustomFood)[]).filter((k) => patch[k] !== undefined)
  if (!keys.length) return (await getFood(db, id))!
  const { rows } = await unique(() =>
    db.query<Food>(
      `update foods set ${keys.map((k, i) => `${COLUMNS[k]} = $${i + 2}`).join(', ')}, updated_at = now()
        where id = $1 returning ${FOOD_COLUMNS}`,
      [id, ...keys.map((k) => patch[k])],
    ),
  )
  return rows[0]
}

export async function deleteCustom(db: Queryable, id: string) {
  await customOrThrow(db, id)
  await db.query('delete from foods where id = $1', [id])
}

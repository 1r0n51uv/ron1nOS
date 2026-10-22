// Registrare un pasto (NUT-003): righe aggiunte allo slot di un giorno, con
// kcal e macro calcolati e copiati al momento (snapshot), così lo storico
// non cambia se l'alimento viene corretto dopo.
import type { Queryable } from '../db.ts'
import { macrosFor } from './day.ts'
import type { Food, FoodCandidate } from './foods.ts'
import { ensureFood, getFood } from './foods.ts'
import { NotFoundError } from './http.ts'
import type { Slot } from './schemas.ts'

export type NewItem = { grams: number } & ({ foodId: string } | { food: FoodCandidate })

// Il pasto di un giorno e slot: uno solo, creato alla prima riga.
export async function mealEntry(db: Queryable, day: string, slot: Slot) {
  const { rows } = await db.query<{ id: string }>(
    `insert into meal_entries (day, slot) values ($1, $2)
     on conflict (day, slot) do update set day = excluded.day returning id`,
    [day, slot],
  )
  return rows[0].id
}

export async function resolveFood(db: Queryable, item: NewItem): Promise<Food> {
  if ('foodId' in item) {
    const food = await getFood(db, item.foodId)
    if (!food) throw new NotFoundError('Alimento non trovato')
    return food
  }
  return ensureFood(db, item.food)
}

// Inserisce le righe di un alimento; restituisce gli id creati.
export async function addItems(
  db: Queryable,
  mealId: string,
  items: { food: Food; grams: number }[],
  { sync = 'local' }: { sync?: 'local' | 'pending' } = {},
) {
  const { rows: last } = await db.query<{ n: number }>(
    `select coalesce(max(order_index) + 1, 0)::int as n from meal_entry_items where meal_entry_id = $1`,
    [mealId],
  )
  const ids: string[] = []
  for (const [i, { food, grams }] of items.entries()) {
    const m = macrosFor(
      {
        calories_per_100g: food.kcal,
        protein_g_per_100g: food.protein,
        carbs_g_per_100g: food.carbs,
        fat_g_per_100g: food.fat,
      },
      grams,
    )
    const { rows } = await db.query<{ id: string }>(
      `insert into meal_entry_items (meal_entry_id, food_id, food_name, quantity_g, calories, protein_g, carbs_g,
         fat_g, caffeine_mg, order_index, yazio_sync)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning id`,
      [
        mealId,
        food.id,
        food.brand && !food.name.toLowerCase().includes(food.brand.toLowerCase())
          ? `${food.name} (${food.brand})`
          : food.name,
        grams,
        m.kcal,
        m.protein,
        m.carbs,
        m.fat,
        ((food.caffeineMg ?? 0) * grams) / 100,
        last[0].n + i,
        sync,
      ],
    )
    ids.push(rows[0].id)
  }
  return ids
}

export async function logMeal(
  db: Queryable,
  { day, slot, items }: { day: string; slot: Slot; items: NewItem[] },
  opts: { sync?: 'local' | 'pending' } = {},
) {
  const foods = []
  for (const item of items) foods.push({ food: await resolveFood(db, item), grams: item.grams })
  const mealId = await mealEntry(db, day, slot)
  return addItems(db, mealId, foods, opts)
}

// Lo slot proposto è quello dell'ora corrente (NUT-003).
export function slotForHour(hour: number): Slot {
  if (hour < 10) return 'breakfast'
  if (hour < 12) return 'morning_snack'
  if (hour < 15) return 'lunch'
  if (hour < 18) return 'afternoon_snack'
  return 'dinner'
}

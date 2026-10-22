// Pianificare un pasto (NUT-009): una ricetta o una lista di alimenti su un
// giorno e uno slot, nel passato o nel futuro. Segnarlo mangiato crea le
// righe del diario; spegnerlo le cancella (ADR-0032).
import type { Queryable } from '../db.ts'
import type { Food } from './foods.ts'
import { getFood } from './foods.ts'
import { ConflictError, InvalidRequestError, NotFoundError } from './http.ts'
import type { LogItem } from './meals.ts'
import { addItems, mealEntry, resolveFood } from './meals.ts'
import { recipeFoods } from './recipes.ts'
import type { Slot } from './schemas.ts'

export type PlanStatus = 'planned' | 'eaten' | 'skipped'

type Plan = { id: string; day: string; slot: Slot; status: PlanStatus; mealId: string | null }

async function planBy(db: Queryable, where: string, params: unknown[]): Promise<Plan | undefined> {
  const { rows } = await db.query<Plan>(
    `select id, day, slot, status, meal_entry_id as "mealId" from planned_meals ${where} for update`,
    params,
  )
  return rows[0]
}

async function planOrThrow(db: Queryable, id: string) {
  const plan = await planBy(db, 'where id = $1', [id])
  if (!plan) throw new NotFoundError('Pasto pianificato non trovato')
  return plan
}

const eatenError = () =>
  new ConflictError('plan_eaten', 'Il pasto è già mangiato: per cambiarlo, prima toglilo dai mangiati')

// Gli alimenti del piano; con una sola ricetta il piano la ricorda.
async function expand(db: Queryable, items: LogItem[]) {
  const foods: { food: Food; grams: number }[] = []
  for (const item of items) {
    if ('recipeId' in item) foods.push(...(await recipeFoods(db, item.recipeId, item.factor)).foods)
    else foods.push({ food: await resolveFood(db, item), grams: item.grams })
  }
  if (!foods.length) throw new InvalidRequestError('Il piano non ha alimenti')
  const only = items.length === 1 && 'recipeId' in items[0] ? items[0].recipeId : null
  return { foods, recipeId: only }
}

// Crea o sostituisce il piano di un giorno e slot, finché non è mangiato.
// Un piano saltato torna pianificato.
export async function setPlan(
  db: Queryable,
  { day, slot, items }: { day: string; slot: Slot; items: LogItem[] },
) {
  const { foods, recipeId } = await expand(db, items)
  const existing = await planBy(db, 'where day = $1 and slot = $2', [day, slot])
  if (existing?.status === 'eaten') throw eatenError()
  let id = existing?.id
  if (id) {
    await db.query(
      `update planned_meals set recipe_id = $2, status = 'planned', template_id = null, updated_at = now() where id = $1`,
      [id, recipeId],
    )
    await db.query('delete from planned_meal_items where planned_meal_id = $1', [id])
  } else {
    const { rows } = await db.query<{ id: string }>(
      `insert into planned_meals (day, slot, recipe_id) values ($1, $2, $3) returning id`,
      [day, slot, recipeId],
    )
    id = rows[0].id
  }
  for (const [i, { food, grams }] of foods.entries()) {
    await db.query(
      `insert into planned_meal_items (planned_meal_id, food_id, food_name, quantity_g, order_index)
       values ($1, $2, $3, $4, $5)`,
      [id, food.id, food.name, grams, i],
    )
  }
  return day
}

export async function deletePlan(db: Queryable, id: string) {
  const plan = await planOrThrow(db, id)
  if (plan.status === 'eaten') throw eatenError()
  await db.query('delete from planned_meals where id = $1', [id])
  return plan.day
}

// Cancella le righe create segnando mangiato; il pasto vuoto sparisce.
async function uneat(db: Queryable, plan: Plan) {
  await db.query('delete from meal_entry_items where planned_meal_id = $1', [plan.id])
  if (plan.mealId) {
    await db.query(
      `delete from meal_entries e where e.id = $1
         and not exists (select 1 from meal_entry_items i where i.meal_entry_id = e.id)`,
      [plan.mealId],
    )
  }
}

async function eat(db: Queryable, plan: Plan) {
  const { rows } = await db.query<{ foodId: string | null; grams: number }>(
    `select food_id as "foodId", quantity_g as grams from planned_meal_items
      where planned_meal_id = $1 order by order_index`,
    [plan.id],
  )
  const foods: { food: Food; grams: number }[] = []
  for (const r of rows) {
    const food = r.foodId ? await getFood(db, r.foodId) : null
    if (food) foods.push({ food, grams: r.grams })
  }
  if (!foods.length) throw new ConflictError('plan_empty', 'Il piano non ha alimenti da registrare')
  const mealId = await mealEntry(db, plan.day, plan.slot)
  await addItems(db, mealId, foods, { plannedMealId: plan.id })
  return mealId
}

// L'interruttore del piano: mangiato, saltato o di nuovo pianificato.
export async function setPlanStatus(db: Queryable, id: string, status: PlanStatus) {
  const plan = await planOrThrow(db, id)
  if (plan.status === status) return plan.day
  if (plan.status === 'eaten') await uneat(db, plan)
  const mealId = status === 'eaten' ? await eat(db, plan) : null
  await db.query(
    `update planned_meals set status = $2, meal_entry_id = $3, updated_at = now() where id = $1`,
    [id, status, mealId],
  )
  return plan.day
}

// Ricette (NUT-008): nome, note e alimenti con grammi. Kcal e macro si
// calcolano dagli alimenti di oggi; registrando o pianificando la ricetta
// le righe del diario ne copiano i valori (NUT-003).
import type { Queryable } from '../db.ts'
import type { Macros } from './day.ts'
import { macrosFor, round, sum } from './day.ts'
import type { Food } from './foods.ts'
import { getFood } from './foods.ts'
import { NotFoundError } from './http.ts'
import { recipeImage } from './images.ts'
import type { NewItem } from './meals.ts'
import { resolveFood } from './meals.ts'

export type RecipeItem = Macros & {
  id: string
  foodId: string | null
  name: string
  grams: number
  // L'alimento è stato eliminato: la riga resta ma non conta.
  missing: boolean
}

// Un'azione collegata a una ricetta (NUT-035): un promemoria `daysBefore`
// giorni prima del pasto, all'ora `time`.
export type RecipeAction = { id: string; title: string; daysBefore: number; time: string; enabled: boolean }

export type Recipe = Macros & {
  id: string
  name: string
  notes: string | null
  // Il procedimento, un passo per riga (NUT-030).
  steps: string[]
  // La foto, se la ricetta viene da YAZIO e ne ha una (NUT-034).
  imageUrl: string | null
  // La foto in preparazione o non riuscita (NUT-036).
  photo: { state: 'generating' | 'failed'; error: string | null } | null
  actions: RecipeAction[]
  grams: number
  items: RecipeItem[]
}

export type RecipeInput = {
  name: string
  notes: string | null
  steps?: string[]
  actions?: RecipeAction[]
  items: NewItem[]
}

type Row = Omit<RecipeItem, keyof Macros | 'missing'> & {
  recipeId: string
  kcal100: number | null
  protein100: number | null
  carbs100: number | null
  fat100: number | null
}

async function load(db: Queryable, where: string, params: unknown[]): Promise<Recipe[]> {
  const { rows: recipes } = await db.query<{
    id: string
    name: string
    notes: string | null
    steps: string[]
    actions: RecipeAction[]
    imageUrl: string | null
    photoState: 'generating' | 'failed' | null
    photoError: string | null
  }>(
    `select id, name, notes, steps, actions, image_url as "imageUrl", photo_state as "photoState",
            photo_error as "photoError" from recipes ${where} order by lower(name), id`,
    params,
  )
  if (!recipes.length) return []
  const { rows: items } = await db.query<Row>(
    `select ri.id, ri.recipe_id as "recipeId", ri.food_id as "foodId", ri.food_name as name, ri.quantity_g as grams,
            f.calories_per_100g as kcal100, f.protein_g_per_100g as protein100, f.carbs_g_per_100g as carbs100,
            f.fat_g_per_100g as fat100
       from recipe_items ri left join foods f on f.id = ri.food_id
      where ri.recipe_id = any($1) order by ri.order_index, ri.id`,
    [recipes.map((r) => r.id)],
  )
  return recipes.map((r) => {
    const mine = items
      .filter((i) => i.recipeId === r.id)
      .map(({ recipeId: _r, kcal100, protein100, carbs100, fat100, ...i }): RecipeItem => {
        const m =
          kcal100 === null
            ? { kcal: 0, protein: 0, carbs: 0, fat: 0 }
            : macrosFor(
                {
                  calories_per_100g: kcal100,
                  protein_g_per_100g: protein100 ?? 0,
                  carbs_g_per_100g: carbs100 ?? 0,
                  fat_g_per_100g: fat100 ?? 0,
                },
                i.grams,
              )
        return { ...i, ...m, missing: kcal100 === null }
      })
    const { photoState, photoError, ...rest } = r
    return {
      ...rest,
      imageUrl: recipeImage(r.imageUrl),
      photo: photoState ? { state: photoState, error: photoError } : null,
      ...round(sum(mine)),
      grams: mine.reduce((a, i) => a + i.grams, 0),
      items: mine.map((i) => ({ ...i, ...round(i) })),
    }
  })
}

export const listRecipes = (db: Queryable) => load(db, '', [])

export async function getRecipe(db: Queryable, id: string) {
  const [recipe] = await load(db, 'where id = $1', [id])
  if (!recipe) throw new NotFoundError('Ricetta non trovata')
  return recipe
}

async function writeItems(db: Queryable, recipeId: string, items: NewItem[]) {
  for (const [i, item] of items.entries()) {
    const food = await resolveFood(db, item)
    await db.query(
      `insert into recipe_items (recipe_id, food_id, food_name, quantity_g, order_index) values ($1, $2, $3, $4, $5)`,
      [recipeId, food.id, food.name, item.grams, i],
    )
  }
}

export async function createRecipe(db: Queryable, input: RecipeInput) {
  const { rows } = await db.query<{ id: string }>(
    'insert into recipes (name, notes, steps, actions) values ($1, $2, $3::jsonb, $4::jsonb) returning id',
    [input.name, input.notes, JSON.stringify(input.steps ?? []), JSON.stringify(input.actions ?? [])],
  )
  await writeItems(db, rows[0].id, input.items)
  return rows[0].id
}

// Sostituisce nome, note e alimenti, e il procedimento e le azioni se ci sono.
export async function updateRecipe(db: Queryable, id: string, input: RecipeInput) {
  const { rowCount } = await db.query(
    `update recipes set name = $2, notes = $3, steps = coalesce($4::jsonb, steps),
            actions = coalesce($5::jsonb, actions), updated_at = now() where id = $1`,
    [
      id,
      input.name,
      input.notes,
      input.steps ? JSON.stringify(input.steps) : null,
      input.actions ? JSON.stringify(input.actions) : null,
    ],
  )
  if (!rowCount) throw new NotFoundError('Ricetta non trovata')
  await db.query('delete from recipe_items where recipe_id = $1', [id])
  await writeItems(db, id, input.items)
}

export async function deleteRecipe(db: Queryable, id: string) {
  const { rowCount } = await db.query('delete from recipes where id = $1', [id])
  if (!rowCount) throw new NotFoundError('Ricetta non trovata')
}

// Gli alimenti di una ricetta per `factor` porzioni, pronti per il diario o
// il piano. Le righe senza alimento si saltano.
export async function recipeFoods(db: Queryable, id: string, factor = 1) {
  const recipe = await getRecipe(db, id)
  const out: { food: Food; grams: number }[] = []
  for (const item of recipe.items) {
    if (!item.foodId) continue
    const food = await getFood(db, item.foodId)
    if (food) out.push({ food, grams: item.grams * factor })
  }
  return { recipe, foods: out }
}

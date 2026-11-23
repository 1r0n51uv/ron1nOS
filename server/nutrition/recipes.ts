// Ricette (NUT-008): nome, note e alimenti con grammi. Kcal e macro si
// calcolano dagli alimenti di oggi; registrando o pianificando la ricetta
// le righe del diario ne copiano i valori (NUT-003).
import type { Queryable } from '../db.ts'
import type { Macros } from './day.ts'
import { macrosFor, round, sum } from './day.ts'
import type { Food } from './foods.ts'
import { getFood } from './foods.ts'
import { ConflictError, InvalidRequestError, NotFoundError } from './http.ts'
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

export const CATEGORIES = ['lunch', 'dinner', 'snack', 'cold', 'hot'] as const
export type Category = (typeof CATEGORIES)[number]

export const ROLES = ['course', 'side', 'bread'] as const
export type Role = (typeof ROLES)[number]

// Una parte di una ricetta composta (NUT-037): un'altra ricetta, per `factor` porzioni.
export type RecipePart = {
  id: string
  role: Role
  recipeId: string
  name: string
  imageUrl: string | null
  factor: number
  kcal: number
}

export type Recipe = Macros & {
  id: string
  name: string
  notes: string | null
  categories: Category[]
  // Le ricette che compongono questa; vuoto per una ricetta semplice (NUT-037).
  parts: RecipePart[]
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
  categories?: Category[]
  parts?: { role: Role; recipeId: string; factor: number }[]
  steps?: string[]
  actions?: RecipeAction[]
  items?: NewItem[]
}

type Row = Omit<RecipeItem, keyof Macros | 'missing'> & {
  recipeId: string
  kcal100: number | null
  protein100: number | null
  carbs100: number | null
  fat100: number | null
}

const itemMacros = (r: Row, grams: number): Macros =>
  r.kcal100 === null
    ? { kcal: 0, protein: 0, carbs: 0, fat: 0 }
    : macrosFor(
        {
          calories_per_100g: r.kcal100,
          protein_g_per_100g: r.protein100 ?? 0,
          carbs_g_per_100g: r.carbs100 ?? 0,
          fat_g_per_100g: r.fat100 ?? 0,
        },
        grams,
      )

type PartRow = { id: string; recipeId: string; partId: string; role: Role; factor: number }

async function load(db: Queryable, where: string, params: unknown[]): Promise<Recipe[]> {
  const { rows: recipes } = await db.query<{
    id: string
    name: string
    notes: string | null
    steps: string[]
    categories: Category[]
    actions: RecipeAction[]
    imageUrl: string | null
    photoState: 'generating' | 'failed' | null
    photoError: string | null
  }>(
    `select id, name, notes, steps, categories, actions, image_url as "imageUrl", photo_state as "photoState",
            photo_error as "photoError" from recipes ${where} order by lower(name), id`,
    params,
  )
  if (!recipes.length) return []
  const { rows: parts } = await db.query<PartRow>(
    `select id, recipe_id as "recipeId", part_recipe_id as "partId", role, factor::float8 as factor
       from recipe_parts where recipe_id = any($1) order by order_index, id`,
    [recipes.map((r) => r.id)],
  )
  // Gli alimenti servono anche alle ricette che compongono le altre.
  const ids = [...new Set([...recipes.map((r) => r.id), ...parts.map((p) => p.partId)])]
  const { rows: items } = await db.query<Row>(
    `select ri.id, ri.recipe_id as "recipeId", ri.food_id as "foodId", ri.food_name as name, ri.quantity_g as grams,
            f.calories_per_100g as kcal100, f.protein_g_per_100g as protein100, f.carbs_g_per_100g as carbs100,
            f.fat_g_per_100g as fat100
       from recipe_items ri left join foods f on f.id = ri.food_id
      where ri.recipe_id = any($1) order by ri.order_index, ri.id`,
    [ids],
  )
  const { rows: partMeta } = await db.query<{ id: string; name: string; imageUrl: string | null }>(
    `select id, name, image_url as "imageUrl" from recipes where id = any($1)`,
    [parts.map((p) => p.partId)],
  )
  const metaById = new Map(partMeta.map((m) => [m.id, m]))

  const own = (recipeId: string): RecipeItem[] =>
    items
      .filter((i) => i.recipeId === recipeId)
      .map((row): RecipeItem => {
        const { recipeId: _r, kcal100, protein100: _p, carbs100: _c, fat100: _f, ...i } = row
        return { ...i, ...itemMacros(row, row.grams), missing: kcal100 === null }
      })

  return recipes.map((r) => {
    const mine = parts.filter((p) => p.recipeId === r.id)
    // Una ricetta composta non ha alimenti suoi: li prende da quelle che la compongono.
    const list = mine.length
      ? mine.flatMap((p) =>
          own(p.partId).map((i): RecipeItem => ({
            ...i,
            id: `${p.id}/${i.id}`,
            grams: i.grams * p.factor,
            kcal: i.kcal * p.factor,
            protein: i.protein * p.factor,
            carbs: i.carbs * p.factor,
            fat: i.fat * p.factor,
          })),
        )
      : own(r.id)
    const total = round(sum(list))
    const { photoState, photoError, ...rest } = r
    return {
      ...rest,
      imageUrl: recipeImage(r.imageUrl),
      photo: photoState ? { state: photoState, error: photoError } : null,
      parts: mine.map((p): RecipePart => {
        const meta = metaById.get(p.partId)
        const partKcal = own(p.partId).reduce((a, i) => a + i.kcal, 0) * p.factor
        return {
          id: p.id,
          role: p.role,
          recipeId: p.partId,
          name: meta?.name ?? '',
          imageUrl: recipeImage(meta?.imageUrl ?? null),
          factor: p.factor,
          kcal: Math.round(partKcal),
        }
      }),
      ...total,
      grams: list.reduce((a, i) => a + i.grams, 0),
      items: list.map((i) => ({ ...i, ...round(i) })),
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

// Le parti di una ricetta composta (NUT-037): ricette semplici, mai se stessa.
async function writeParts(db: Queryable, recipeId: string, parts: NonNullable<RecipeInput['parts']>) {
  for (const [i, part] of parts.entries()) {
    if (part.recipeId === recipeId) throw new InvalidRequestError('Una ricetta non può contenere se stessa')
    const { rows } = await db.query<{ composed: boolean }>(
      `select exists (select 1 from recipe_parts where recipe_id = $1) as composed from recipes where id = $1`,
      [part.recipeId],
    )
    if (!rows.length) throw new NotFoundError('Ricetta non trovata')
    if (rows[0].composed) throw new InvalidRequestError("Una ricetta composta non può stare in un'altra")
    await db.query(
      `insert into recipe_parts (recipe_id, part_recipe_id, role, factor, order_index) values ($1, $2, $3, $4, $5)`,
      [recipeId, part.recipeId, part.role, part.factor, i],
    )
  }
}

export async function createRecipe(db: Queryable, input: RecipeInput) {
  const { rows } = await db.query<{ id: string }>(
    `insert into recipes (name, notes, steps, actions, categories) values ($1, $2, $3::jsonb, $4::jsonb, $5)
     returning id`,
    [
      input.name,
      input.notes,
      JSON.stringify(input.steps ?? []),
      JSON.stringify(input.actions ?? []),
      input.categories ?? [],
    ],
  )
  if (input.parts?.length) await writeParts(db, rows[0].id, input.parts)
  else await writeItems(db, rows[0].id, input.items ?? [])
  return rows[0].id
}

// Sostituisce nome, note e alimenti (o parti), e il procedimento, le azioni e
// le categorie se ci sono.
export async function updateRecipe(db: Queryable, id: string, input: RecipeInput) {
  const { rowCount } = await db.query(
    `update recipes set name = $2, notes = $3, steps = coalesce($4::jsonb, steps),
            actions = coalesce($5::jsonb, actions), categories = coalesce($6::text[], categories),
            updated_at = now() where id = $1`,
    [
      id,
      input.name,
      input.notes,
      input.steps ? JSON.stringify(input.steps) : null,
      input.actions ? JSON.stringify(input.actions) : null,
      input.categories ?? null,
    ],
  )
  if (!rowCount) throw new NotFoundError('Ricetta non trovata')
  await db.query('delete from recipe_items where recipe_id = $1', [id])
  await db.query('delete from recipe_parts where recipe_id = $1', [id])
  if (input.parts?.length) {
    const { rows } = await db.query('select 1 from recipe_parts where part_recipe_id = $1 limit 1', [id])
    if (rows.length)
      throw new InvalidRequestError('Una ricetta usata in una composta non può diventare composta')
    await writeParts(db, id, input.parts)
  } else await writeItems(db, id, input.items ?? [])
}

// Cambia le sole categorie (NUT-037), dal menu rapido dell'app.
export async function setCategories(db: Queryable, id: string, categories: Category[]) {
  const { rowCount } = await db.query(
    'update recipes set categories = $2, updated_at = now() where id = $1',
    [id, categories],
  )
  if (!rowCount) throw new NotFoundError('Ricetta non trovata')
}

export async function deleteRecipe(db: Queryable, id: string) {
  const { rows: used } = await db.query<{ name: string }>(
    `select r.name from recipe_parts p join recipes r on r.id = p.recipe_id where p.part_recipe_id = $1 limit 1`,
    [id],
  )
  if (used.length) {
    throw new ConflictError('recipe_in_use', `La ricetta fa parte di "${used[0].name}": toglila prima da lì`)
  }
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

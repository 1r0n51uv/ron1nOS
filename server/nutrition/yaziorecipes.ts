// Import dei preferiti YAZIO tra le ricette (NUT-008). Ripetibile: la
// ricetta si riconosce da `yazio_recipe_id`, quindi un nuovo giro aggiorna
// nome e alimenti senza duplicare. Le ricette tolte dai preferiti restano
// qui (potrebbero essere già pianificate). Le note non si toccano.
import type { Db, Queryable } from '../db.ts'
import type { YazioClient } from '../yazio/client.ts'
import type { Recipe } from '../yazio/schemas.ts'
import { ensureFood } from './foods.ts'
import { fromYazioDetail } from './yaziosearch.ts'

export type RecipeImport = {
  created: number
  updated: number
  // Ricette non importate, con il motivo.
  skipped: { yazioId: string; reason: 'not_found' | 'no_items' }[]
  // Ingredienti lasciati fuori: unità diversa dai grammi o prodotto sparito.
  skippedItems: number
  // Importate in passato e ora non più nei preferiti.
  removedUpstream: number
}

type Item = { foodId: string; name: string; grams: number }

export async function importYazioRecipes(db: Db, client: YazioClient): Promise<RecipeImport> {
  const ids = await client.recipeIds()
  const result: RecipeImport = { created: 0, updated: 0, skipped: [], skippedItems: 0, removedUpstream: 0 }
  const foods = new Map<string, { id: string; name: string } | null>()

  const foodFor = async (productId: string) => {
    if (!foods.has(productId)) foods.set(productId, await resolve(db, client, productId))
    return foods.get(productId)!
  }

  for (const yazioId of ids) {
    const recipe = await client.recipe(yazioId)
    if (!recipe) {
      result.skipped.push({ yazioId, reason: 'not_found' })
      continue
    }
    const items = await toItems(recipe, foodFor)
    result.skippedItems += recipe.servings.length - items.length
    if (!items.length) {
      result.skipped.push({ yazioId, reason: 'no_items' })
      continue
    }
    const created = await db.tx((tx) => save(tx, yazioId, recipe.name, items))
    result[created ? 'created' : 'updated']++
  }

  const { rows } = await db.query<{ n: number }>(
    `select count(*)::int as n from recipes where yazio_recipe_id is not null and not (yazio_recipe_id = any($1))`,
    [ids],
  )
  result.removedUpstream = rows[0]!.n
  return result
}

// Solo grammi: la prova del 2026-11-09 li ha trovati ovunque; ml o altre
// unità non si convertono a occhio.
async function toItems(
  recipe: Recipe,
  foodFor: (productId: string) => Promise<{ id: string; name: string } | null>,
) {
  const items: Item[] = []
  for (const s of recipe.servings) {
    if (s.base_unit !== 'g' || !(s.amount > 0)) continue
    const food = await foodFor(s.product_id)
    if (food) items.push({ foodId: food.id, name: food.name, grams: s.amount })
  }
  return items
}

// L'alimento già nel catalogo (stesso prodotto YAZIO) si riusa; altrimenti
// entra dalla scheda del prodotto. null se YAZIO non lo ha più.
async function resolve(db: Queryable, client: YazioClient, productId: string) {
  const { rows } = await db.query<{ id: string; name: string }>(
    `select id, name from foods where yazio_product_id = $1 or (source = 'yazio' and external_id = $1)
      order by (yazio_product_id = $1) desc limit 1`,
    [productId],
  )
  if (rows[0]) return rows[0]
  const product = await client.product(productId)
  const candidate = product && fromYazioDetail(product)
  if (!candidate) return null
  const food = await ensureFood(db, candidate)
  return { id: food.id!, name: food.name }
}

// true se la ricetta è nuova.
async function save(db: Queryable, yazioId: string, name: string, items: Item[]) {
  const { rows } = await db.query<{ id: string }>(
    `insert into recipes (name, yazio_recipe_id) values ($1, $2)
     on conflict (yazio_recipe_id) where yazio_recipe_id is not null
     do update set name = excluded.name, updated_at = now()
     returning id, (xmax = 0) as inserted`,
    [name, yazioId],
  )
  const row = rows[0] as { id: string; inserted: boolean }
  await db.query('delete from recipe_items where recipe_id = $1', [row.id])
  for (const [i, item] of items.entries()) {
    await db.query(
      `insert into recipe_items (recipe_id, food_id, food_name, quantity_g, order_index) values ($1, $2, $3, $4, $5)`,
      [row.id, item.foodId, item.name, item.grams, i],
    )
  }
  return row.inserted
}

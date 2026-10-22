// Template settimanali (NUT-010): per ogni giorno e slot una ricetta o un
// alimento, mai entrambi. Applicati a una settimana, da lunedì, creano i
// pasti pianificati e sostituiscono solo quelli ancora pianificati.
import type { Queryable } from '../db.ts'
import { addDays, weekday } from './dates.ts'
import { macrosFor, round } from './day.ts'
import { InvalidRequestError, NotFoundError } from './http.ts'
import type { NewItem } from './meals.ts'
import { resolveFood } from './meals.ts'
import { planBy, setPlan } from './plans.ts'
import type { Recipe } from './recipes.ts'
import { listRecipes } from './recipes.ts'
import type { Slot } from './schemas.ts'
import { SLOTS } from './schemas.ts'

// Un alimento esterno della ricerca entra nel catalogo adesso.
export type CellInput = { weekday: number; slot: Slot } & ({ recipeId: string } | NewItem)

export type Cell = {
  weekday: number
  slot: Slot
  recipeId: string | null
  foodId: string | null
  grams: number | null
  name: string
  kcal: number
}

export type Template = { id: string; name: string; cells: Cell[]; dayKcal: number[] }

type CellRow = {
  templateId: string
  weekday: number
  slot: Slot
  recipeId: string | null
  foodId: string | null
  grams: number | null
  foodName: string | null
  kcal100: number | null
}

async function load(db: Queryable, where: string, params: unknown[]): Promise<Template[]> {
  const { rows: templates } = await db.query<{ id: string; name: string }>(
    `select id, name from diet_templates ${where} order by lower(name), id`,
    params,
  )
  if (!templates.length) return []
  const [{ rows: cells }, recipes] = await Promise.all([
    db.query<CellRow>(
      `select c.template_id as "templateId", c.weekday, c.slot, c.recipe_id as "recipeId", c.food_id as "foodId",
              c.quantity_g as grams, f.name as "foodName", f.calories_per_100g as kcal100
         from diet_template_items c left join foods f on f.id = c.food_id
        where c.template_id = any($1)`,
      [templates.map((t) => t.id)],
    ),
    listRecipes(db),
  ])
  const byId = new Map<string, Recipe>(recipes.map((r) => [r.id, r]))
  const order = (c: { weekday: number; slot: Slot }) => c.weekday * 10 + SLOTS.indexOf(c.slot)
  return templates.map((t) => {
    const mine = cells
      .filter((c) => c.templateId === t.id)
      .sort((a, b) => order(a) - order(b))
      .map(({ templateId: _t, foodName, kcal100, ...c }): Cell => {
        const recipe = c.recipeId ? byId.get(c.recipeId) : undefined
        const kcal = recipe
          ? recipe.kcal
          : round(
              macrosFor(
                {
                  calories_per_100g: kcal100 ?? 0,
                  protein_g_per_100g: 0,
                  carbs_g_per_100g: 0,
                  fat_g_per_100g: 0,
                },
                c.grams ?? 0,
              ),
            ).kcal
        return { ...c, name: recipe?.name ?? foodName ?? '', kcal }
      })
    const dayKcal = [1, 2, 3, 4, 5, 6, 7].map((d) =>
      mine.filter((c) => c.weekday === d).reduce((a, c) => a + c.kcal, 0),
    )
    return { ...t, cells: mine, dayKcal }
  })
}

export const listTemplates = (db: Queryable) => load(db, '', [])

export async function getTemplate(db: Queryable, id: string) {
  const [t] = await load(db, 'where id = $1', [id])
  if (!t) throw new NotFoundError('Template non trovato')
  return t
}

async function writeCells(db: Queryable, id: string, cells: CellInput[]) {
  const seen = new Set<string>()
  for (const c of cells) {
    const key = `${c.weekday}-${c.slot}`
    if (seen.has(key)) throw new InvalidRequestError('Una sola voce per giorno e pasto')
    seen.add(key)
  }
  await db.query('delete from diet_template_items where template_id = $1', [id])
  for (const c of cells) {
    const recipe = 'recipeId' in c ? c.recipeId : null
    const food = 'recipeId' in c ? null : (await resolveFood(db, c)).id
    const grams = 'grams' in c ? c.grams : null
    if (recipe && !(await db.query('select 1 from recipes where id = $1', [recipe])).rowCount) {
      throw new NotFoundError('Ricetta non trovata')
    }
    await db.query(
      `insert into diet_template_items (template_id, weekday, slot, recipe_id, food_id, quantity_g)
       values ($1, $2, $3, $4, $5, $6)`,
      [id, c.weekday, c.slot, recipe, food, grams],
    )
  }
}

export async function createTemplate(db: Queryable, { name, cells }: { name: string; cells: CellInput[] }) {
  const { rows } = await db.query<{ id: string }>(
    'insert into diet_templates (name) values ($1) returning id',
    [name],
  )
  await writeCells(db, rows[0].id, cells)
  return rows[0].id
}

export async function updateTemplate(
  db: Queryable,
  id: string,
  { name, cells }: { name: string; cells: CellInput[] },
) {
  const { rowCount } = await db.query(
    'update diet_templates set name = $2, updated_at = now() where id = $1',
    [id, name],
  )
  if (!rowCount) throw new NotFoundError('Template non trovato')
  await writeCells(db, id, cells)
}

export async function deleteTemplate(db: Queryable, id: string) {
  const { rowCount } = await db.query('delete from diet_templates where id = $1', [id])
  if (!rowCount) throw new NotFoundError('Template non trovato')
}

// Applica il template alla settimana che inizia `monday`: i piani ancora
// pianificati si sostituiscono, mangiati e saltati restano.
export async function applyTemplate(db: Queryable, id: string, monday: string) {
  if (weekday(monday) !== 1) throw new InvalidRequestError('La settimana parte da lunedì')
  const template = await getTemplate(db, id)
  const result = { created: 0, replaced: 0, kept: 0 }
  for (const c of template.cells) {
    const day = addDays(monday, c.weekday - 1)
    const existing = await planBy(db, 'where day = $1 and slot = $2', [day, c.slot])
    if (existing && existing.status !== 'planned') {
      result.kept++
      continue
    }
    const item = c.recipeId ? { recipeId: c.recipeId, factor: 1 } : { foodId: c.foodId!, grams: c.grams! }
    await setPlan(db, { day, slot: c.slot, items: [item] }, { templateId: id })
    result[existing ? 'replaced' : 'created']++
  }
  return result
}

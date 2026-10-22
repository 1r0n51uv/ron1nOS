// Rotte del modulo Nutrizione sotto /api/v1/nutrition (specifica
// docs/specs/nutrition.md, contratto in api/openapi.yaml).
import { Hono } from 'hono'
import { z } from 'zod'

import type { Database, Db } from '../db.ts'
import { DatabaseUnavailableError } from '../db.ts'
import { createCustom, deleteCustom, listCustom, updateCustom } from './custom.ts'
import { localHour, today } from './dates.ts'
import { getDay } from './day.ts'
import type { ExternalSearch } from './foodsearch.ts'
import { addGoal, goalFor, goalHistory } from './goals.ts'
import { check, ConflictError, readJson } from './http.ts'
import { logMeal, nextSlot, removeItem, setGrams, slotForHour } from './meals.ts'
import { Amount, Day, Grams, Slot } from './schemas.ts'
import { createRecipe, deleteRecipe, getRecipe, listRecipes, updateRecipe } from './recipes.ts'
import { findBarcode, searchFoods } from './search.ts'

export type NutritionDeps = {
  database: Database
  // Con YAZIO collegato e la sincronizzazione accesa l'obiettivo arriva da
  // lì e non si modifica a mano (NUT-015, NUT-024).
  goalsFromYazio?: () => Promise<boolean>
  now?: () => Date
  // OpenFoodFacts e USDA; senza, la ricerca usa solo il catalogo locale.
  external?: ExternalSearch
}

const Candidate = z.object({
  source: z.enum(['openfoodfacts', 'usda', 'yazio']),
  externalId: z.string().min(1).max(100),
  name: z.string().trim().min(1).max(200),
  brand: z.string().max(200).nullable().default(null),
  barcode: z
    .string()
    .regex(/^\d{6,14}$/)
    .nullable()
    .default(null),
  servingSizeG: Amount.nullable().default(null),
  kcal: Amount.max(900),
  protein: Amount.max(100),
  carbs: Amount.max(100),
  fat: Amount.max(100),
  caffeineMg: Amount.max(100_000).nullable().default(null),
  yazioProductId: z.string().max(100).nullable().default(null),
})

const MealInput = z.object({
  date: Day,
  slot: Slot,
  items: z
    .array(
      z.union([
        z.object({ foodId: z.uuid(), grams: Grams }),
        z.object({ food: Candidate, grams: Grams }),
        z.object({ recipeId: z.uuid(), factor: z.number().finite().min(0.1).max(10).default(1) }),
      ]),
    )
    .min(1)
    .max(30),
})

const RecipeInput = z.object({
  name: z.string().trim().min(1).max(200),
  notes: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
    z.string().trim().max(2000).nullable().default(null),
  ),
  items: z
    .array(
      z.union([z.object({ foodId: z.uuid(), grams: Grams }), z.object({ food: Candidate, grams: Grams })]),
    )
    .min(1)
    .max(50),
})

// Alimento personale: i campi facoltativi accettano null o stringa vuota.
const blank = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v)
const CustomFields = {
  name: z.string().trim().min(1).max(200),
  brand: z.preprocess(blank, z.string().trim().max(200).nullable()),
  barcode: z.preprocess(
    blank,
    z
      .string()
      .regex(/^\d{6,14}$/)
      .nullable(),
  ),
  servingSizeG: Amount.max(10_000).nullable(),
  kcal: Amount.max(900),
  protein: Amount.max(100),
  carbs: Amount.max(100),
  fat: Amount.max(100),
  caffeineMg: Amount.max(100_000).nullable(),
}
const CustomFoodInput = z.object({
  ...CustomFields,
  brand: CustomFields.brand.optional().transform((v) => v ?? null),
  barcode: CustomFields.barcode.optional().transform((v) => v ?? null),
  servingSizeG: CustomFields.servingSizeG.optional().transform((v) => v ?? null),
  caffeineMg: CustomFields.caffeineMg.optional().transform((v) => v ?? null),
})
const CustomFoodPatch = z.object(CustomFields).partial().strict()

const Barcode = z.string().regex(/^\d{6,14}$/)

// Id di alimenti e righe.
const Id = z.uuid()

const offline: ExternalSearch = { off: async () => [], usda: async () => [], offBarcode: async () => null }

const GoalInput = z.object({
  kcal: z.number().finite().min(800).max(8000),
  protein: Amount.max(1000),
  carbs: Amount.max(2000),
  fat: Amount.max(1000),
  waterMl: Amount.max(10_000).nullable().optional(),
  effectiveFrom: Day.optional(),
})

export function nutritionRoutes({
  database,
  goalsFromYazio = async () => false,
  now = () => new Date(),
  external = offline,
}: NutritionDeps) {
  const app = new Hono<{ Variables: { db: Db } }>()

  // Senza Postgres il modulo risponde 503; il resto della dashboard no.
  app.use('*', async (c, next) => {
    if (database.status() !== 'ok' || !database.db) throw new DatabaseUnavailableError('database non pronto')
    c.set('db', database.db)
    await next()
  })

  // Il giorno completo: slot, totali, obiettivo (NUT-001, NUT-002). Solo
  // per oggi, lo slot dell'ora corrente (NUT-003) e il prossimo pasto da
  // segnare (NUT-001).
  async function dayView(db: Db, day: string) {
    const result = await getDay(db, day)
    if (day !== today(now())) return { ...result, suggestedSlot: null, nextSlot: null }
    const suggestedSlot = slotForHour(localHour(now()))
    return { ...result, suggestedSlot, nextSlot: nextSlot(result.slots, suggestedSlot) }
  }

  app.get('/day', async (c) => {
    const day = c.req.query('date') ? check(Day, c.req.query('date')) : today(now())
    return c.json(await dayView(c.get('db'), day))
  })

  // Registra uno o più alimenti in uno slot di un giorno qualsiasi (NUT-003):
  // un alimento del catalogo (foodId) o un risultato esterno (food), che
  // entra nel catalogo adesso. Risponde con il giorno aggiornato.
  app.post('/meals', async (c) => {
    const input = await readJson(c, MealInput)
    const db = c.get('db')
    await db.tx((tx) => logMeal(tx, { day: input.date, slot: input.slot, items: input.items }))
    return c.json(await dayView(db, input.date), 201)
  })

  // Correggere un pasto (NUT-007): togliere una riga o cambiarne i grammi,
  // anche nei giorni passati. Rispondono con il giorno aggiornato.
  app.delete('/meals/items/:id', async (c) => {
    const db = c.get('db')
    const day = await db.tx((tx) => removeItem(tx, check(Id, c.req.param('id'))))
    return c.json(await dayView(db, day))
  })

  app.patch('/meals/items/:id', async (c) => {
    const id = check(Id, c.req.param('id'))
    const { grams } = await readJson(c, z.object({ grams: Grams }))
    const db = c.get('db')
    const day = await db.tx((tx) => setGrams(tx, id, grams))
    return c.json(await dayView(db, day))
  })

  // Ricerca su catalogo locale, OpenFoodFacts e USDA (NUT-004). `italy=0`
  // toglie il filtro Solo Italia, attivo di default.
  app.get('/foods/search', async (c) => {
    const q = c.req.query('q') ?? ''
    const italy = c.req.query('italy') !== '0'
    return c.json(await searchFoods({ db: c.get('db'), external }, q, { italy }))
  })

  // Codice a barre, scritto a mano o letto dalla fotocamera (NUT-005).
  app.get('/foods/barcode/:code', async (c) => {
    const code = check(Barcode, c.req.param('code'))
    return c.json(await findBarcode({ db: c.get('db'), external }, code))
  })

  // Ricette (NUT-008).
  app.get('/recipes', async (c) => c.json({ recipes: await listRecipes(c.get('db')) }))

  app.get('/recipes/:id', async (c) => c.json(await getRecipe(c.get('db'), check(Id, c.req.param('id')))))

  app.post('/recipes', async (c) => {
    const input = await readJson(c, RecipeInput)
    const db = c.get('db')
    const id = await db.tx((tx) => createRecipe(tx, input))
    return c.json(await getRecipe(db, id), 201)
  })

  app.put('/recipes/:id', async (c) => {
    const id = check(Id, c.req.param('id'))
    const input = await readJson(c, RecipeInput)
    const db = c.get('db')
    await db.tx((tx) => updateRecipe(tx, id, input))
    return c.json(await getRecipe(db, id))
  })

  app.delete('/recipes/:id', async (c) => {
    await deleteRecipe(c.get('db'), check(Id, c.req.param('id')))
    return c.body(null, 204)
  })

  // Alimenti personali (NUT-006).
  app.get('/foods', async (c) => c.json({ foods: await listCustom(c.get('db')) }))

  app.post('/foods', async (c) => {
    const input = await readJson(c, CustomFoodInput)
    return c.json(await createCustom(c.get('db'), input), 201)
  })

  app.patch('/foods/:id', async (c) => {
    const id = check(Id, c.req.param('id'))
    const input = await readJson(c, CustomFoodPatch)
    return c.json(await updateCustom(c.get('db'), id, input))
  })

  app.delete('/foods/:id', async (c) => {
    await deleteCustom(c.get('db'), check(Id, c.req.param('id')))
    return c.body(null, 204)
  })

  app.get('/goals', async (c) => {
    const db = c.get('db')
    const day = c.req.query('date') ? check(Day, c.req.query('date')) : today(now())
    const [current, history, fromYazio] = await Promise.all([
      goalFor(db, day),
      goalHistory(db),
      goalsFromYazio(),
    ])
    return c.json({ current, history, editable: !fromYazio })
  })

  app.post('/goals', async (c) => {
    if (await goalsFromYazio()) {
      throw new ConflictError('goals_from_yazio', "L'obiettivo arriva da YAZIO: si cambia nell'app YAZIO")
    }
    const input = await readJson(c, GoalInput)
    const goal = await addGoal(c.get('db'), {
      source: 'manual',
      kcal: input.kcal,
      protein: input.protein,
      carbs: input.carbs,
      fat: input.fat,
      waterMl: input.waterMl ?? null,
      effectiveFrom: input.effectiveFrom ?? today(now()),
    })
    return c.json(goal, 201)
  })

  return app
}

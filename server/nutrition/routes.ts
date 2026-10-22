// Rotte del modulo Nutrizione sotto /api/v1/nutrition (specifica
// docs/specs/nutrition.md, contratto in api/openapi.yaml).
import { Hono } from 'hono'
import { z } from 'zod'

import type { Database, Db } from '../db.ts'
import { DatabaseUnavailableError } from '../db.ts'
import { localHour, today } from './dates.ts'
import { getDay } from './day.ts'
import type { ExternalSearch } from './foodsearch.ts'
import { addGoal, goalFor, goalHistory } from './goals.ts'
import { check, ConflictError, readJson } from './http.ts'
import { logMeal, slotForHour } from './meals.ts'
import { Amount, Day, Grams, Slot } from './schemas.ts'
import { searchFoods } from './search.ts'

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
      z.union([z.object({ foodId: z.uuid(), grams: Grams }), z.object({ food: Candidate, grams: Grams })]),
    )
    .min(1)
    .max(30),
})

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

  // Il giorno completo: slot, totali, obiettivo (NUT-001, NUT-002). Lo slot
  // proposto è quello dell'ora corrente, solo per oggi (NUT-003).
  async function dayView(db: Db, day: string) {
    const suggestedSlot = day === today(now()) ? slotForHour(localHour(now())) : null
    return { ...(await getDay(db, day)), suggestedSlot }
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

  // Ricerca su catalogo locale, OpenFoodFacts e USDA (NUT-004). `italy=0`
  // toglie il filtro Solo Italia, attivo di default.
  app.get('/foods/search', async (c) => {
    const q = c.req.query('q') ?? ''
    const italy = c.req.query('italy') !== '0'
    return c.json(await searchFoods({ db: c.get('db'), external }, q, { italy }))
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

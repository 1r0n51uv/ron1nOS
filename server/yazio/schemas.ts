// Forma delle risposte dell'API non ufficiale di YAZIO, ricavata dallo
// swagger di saganos/yazio_public_api, dal client juriadams/yazio e dalla
// prova del 2026-10-21 (scripts/yazio-probe). Si validano solo i campi che
// il backend usa: un campo in più non rompe nulla, uno che manca o cambia
// tipo diventa YazioFormatError (yazio_format_changed).
import { z } from 'zod'

export const DaytimeSchema = z.enum(['breakfast', 'lunch', 'dinner', 'snack'])
export type Daytime = z.infer<typeof DaytimeSchema>

export const TokenSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.number().positive(),
})

const uuid = z.string().min(1)

export const ConsumedProductSchema = z.object({
  id: uuid,
  date: z.string(),
  daytime: DaytimeSchema,
  product_id: uuid,
  amount: z.number(),
  serving: z.string().nullish(),
  serving_quantity: z.number().nullish(),
})
export type ConsumedProduct = z.infer<typeof ConsumedProductSchema>

export const RecipePortionSchema = z.object({
  id: uuid,
  date: z.string(),
  daytime: DaytimeSchema,
  recipe_id: uuid,
  portion_count: z.number(),
})

export const SimpleProductSchema = z.object({
  id: uuid,
  date: z.string(),
  daytime: DaytimeSchema,
  name: z.string(),
  nutrients: z.record(z.string(), z.number()),
})

export const ConsumedItemsSchema = z.object({
  products: z.array(ConsumedProductSchema),
  recipe_portions: z.array(RecipePortionSchema).default([]),
  simple_products: z.array(SimpleProductSchema).default([]),
})
export type ConsumedItems = z.infer<typeof ConsumedItemsSchema>

// Nutrienti per unità di base (g o ml): energy.energy è in kcal per 1 g.
export const BasicNutrientsSchema = z.object({
  'energy.energy': z.number(),
  'nutrient.carb': z.number().default(0),
  'nutrient.protein': z.number().default(0),
  'nutrient.fat': z.number().default(0),
})

export const GoalsSchema = z.object({
  'energy.energy': z.number(),
  'nutrient.protein': z.number(),
  'nutrient.carb': z.number(),
  'nutrient.fat': z.number(),
  water: z.number().nullish(),
})
export type Goals = z.infer<typeof GoalsSchema>

export const DailySummarySchema = z.object({
  activity_energy: z.number().default(0),
  consume_activity_energy: z.boolean().default(false),
  water_intake: z.number().default(0),
  goals: GoalsSchema,
})
export type DailySummary = z.infer<typeof DailySummarySchema>

const ExerciseSchema = z.object({
  id: uuid,
  date: z.string(),
  name: z.string().nullish(),
  energy: z.number().default(0),
  duration: z.number().nullish(),
})

export const ExercisesSchema = z.object({
  training: z.array(ExerciseSchema).default([]),
  custom_training: z.array(ExerciseSchema).default([]),
})
export type Exercises = z.infer<typeof ExercisesSchema>

export const WaterSchema = z.object({ water_intake: z.number() })

export const WeightSchema = z.object({ date: z.string(), value: z.number().nullable() })
export type Weight = z.infer<typeof WeightSchema>

export const ProductSearchResultSchema = z.object({
  product_id: uuid,
  name: z.string(),
  producer: z.string().nullish(),
  is_verified: z.boolean().default(false),
  base_unit: z.string().default('g'),
  serving: z.string().nullish(),
  serving_quantity: z.number().nullish(),
  amount: z.number().nullish(),
  nutrients: BasicNutrientsSchema,
  countries: z.array(z.string()).default([]),
  language: z.string().nullish(),
})
export type ProductSearchResult = z.infer<typeof ProductSearchResultSchema>

export const ProductSchema = z.object({
  name: z.string(),
  producer: z.string().nullish(),
  is_verified: z.boolean().default(false),
  base_unit: z.string().default('g'),
  nutrients: BasicNutrientsSchema,
  servings: z.array(z.object({ serving: z.string(), amount: z.number() })).default([]),
  eans: z.array(z.string()).default([]),
  countries: z.array(z.string()).default([]),
  language: z.string().nullish(),
})
export type Product = z.infer<typeof ProductSchema> & { id: string }

import { num } from '@/lib/format'
import type { Food, Macros, MealInput, PlannedItem, Recipe } from '../data'

export type FoodDraft = { food: Food; grams: number }
// Una ricetta intera, per `factor` porzioni (NUT-008).
export type RecipeDraft = { recipe: Recipe; factor: number }
export type Draft = FoodDraft | RecipeDraft

// Kcal e macro di una quantità, dai valori per 100 g.
export function macrosOf(food: Food, grams: number): Macros {
  const f = grams / 100
  return { kcal: food.kcal * f, protein: food.protein * f, carbs: food.carbs * f, fat: food.fat * f }
}

export function draftMacros(d: Draft): Macros {
  if ('recipe' in d) {
    const { recipe: r, factor: f } = d
    return { kcal: r.kcal * f, protein: r.protein * f, carbs: r.carbs * f, fat: r.fat * f }
  }
  return macrosOf(d.food, d.grams)
}

export function draftName(d: Draft) {
  return 'recipe' in d ? d.recipe.name : d.food.name
}

export function totalOf(items: Draft[]): Macros {
  return items.reduce(
    (t, d) => {
      const m = draftMacros(d)
      return {
        kcal: t.kcal + m.kcal,
        protein: t.protein + m.protein,
        carbs: t.carbs + m.carbs,
        fat: t.fat + m.fat,
      }
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  )
}

// Grammi scritti a mano: virgola o punto, maggiori di zero.
export function parseGrams(s: string): number | null {
  const n = Number(s.trim().replace(',', '.'))
  return s.trim() !== '' && Number.isFinite(n) && n > 0 && n <= 10_000 ? n : null
}

// La quantità proposta: la porzione dell'alimento, se c'è, o 100 g.
export function defaultGrams(food: Food) {
  return food.servingSizeG && food.servingSizeG > 0 ? food.servingSizeG : 100
}

// Un alimento del catalogo va per id, uno esterno con i suoi valori.
export function toFoodItem({ food, grams }: FoodDraft) {
  if (food.id) return { foodId: food.id, grams }
  const { id: _id, ...rest } = food
  return { food: rest, grams }
}

export function toItem(d: Draft): MealInput['items'][number] {
  return 'recipe' in d ? { recipeId: d.recipe.id, factor: d.factor } : toFoodItem(d)
}

export const SOURCE_TAG: Record<Food['source'], string> = {
  custom: 'mio',
  openfoodfacts: 'off',
  usda: 'usda',
  yazio: 'yazio',
}

export const SOURCE_NAME: Record<Exclude<Food['source'], 'custom'>, string> = {
  openfoodfacts: 'OpenFoodFacts',
  usda: 'USDA',
  yazio: 'YAZIO',
}

export function macroLine(m: { protein: number; carbs: number; fat: number }) {
  return `P ${num(m.protein)} · C ${num(m.carbs)} · G ${num(m.fat)}`
}

// Le righe di un piano da modificare (NUT-009): valori per 100 g ricavati
// dalla quantità; le righe senza alimento si perdono.
export function plannedDrafts(items: PlannedItem[]): FoodDraft[] {
  return items
    .filter((i) => i.foodId && i.grams > 0)
    .map((i) => {
      const f = 100 / i.grams
      return {
        grams: i.grams,
        food: {
          id: i.foodId,
          source: 'custom',
          externalId: null,
          name: i.name,
          brand: null,
          barcode: null,
          servingSizeG: null,
          kcal: i.kcal * f,
          protein: i.protein * f,
          carbs: i.carbs * f,
          fat: i.fat * f,
          caffeineMg: null,
          yazioProductId: null,
        },
      }
    })
}

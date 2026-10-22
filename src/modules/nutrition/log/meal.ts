import type { Food, Macros, MealInput } from '../data'

export type Draft = { food: Food; grams: number }

// Kcal e macro di una quantità, dai valori per 100 g.
export function macrosOf(food: Food, grams: number): Macros {
  const f = grams / 100
  return { kcal: food.kcal * f, protein: food.protein * f, carbs: food.carbs * f, fat: food.fat * f }
}

export function totalOf(items: Draft[]): Macros {
  return items.reduce(
    (t, { food, grams }) => {
      const m = macrosOf(food, grams)
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
export function toItem({ food, grams }: Draft): MealInput['items'][number] {
  if (food.id) return { foodId: food.id, grams }
  const { id: _id, ...rest } = food
  return { food: rest, grams }
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

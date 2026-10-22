import type { Food, Macros, Recipe, RecipeInput } from '../data'
import { toFoodItem } from '../log/meal'

// Una riga dell'editor: l'alimento (per id o esterno), i grammi e i valori
// per 100 g per i totali in diretta.
export type EditorRow = { key: string; name: string; grams: number; per100: Macros } & (
  { foodId: string } | { food: Food }
)

let seq = 0
const nextKey = () => `r${++seq}`

export function rowFromFood(food: Food, grams: number): EditorRow {
  const per100 = { kcal: food.kcal, protein: food.protein, carbs: food.carbs, fat: food.fat }
  return food.id
    ? { key: nextKey(), foodId: food.id, name: food.name, grams, per100 }
    : { key: nextKey(), food, name: food.name, grams, per100 }
}

// Le righe di una ricetta salvata; quelle senza alimento si perdono.
export function rowsFromRecipe(recipe: Recipe): EditorRow[] {
  return recipe.items
    .filter((i) => i.foodId && !i.missing)
    .map((i) => {
      const f = 100 / i.grams
      return {
        key: nextKey(),
        foodId: i.foodId!,
        name: i.name,
        grams: i.grams,
        per100: { kcal: i.kcal * f, protein: i.protein * f, carbs: i.carbs * f, fat: i.fat * f },
      }
    })
}

export function rowMacros(r: EditorRow): Macros {
  const f = r.grams / 100
  return {
    kcal: r.per100.kcal * f,
    protein: r.per100.protein * f,
    carbs: r.per100.carbs * f,
    fat: r.per100.fat * f,
  }
}

export function rowsTotal(rows: EditorRow[]): Macros {
  return rows.map(rowMacros).reduce(
    (t, m) => ({
      kcal: t.kcal + m.kcal,
      protein: t.protein + m.protein,
      carbs: t.carbs + m.carbs,
      fat: t.fat + m.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  )
}

export function toRecipeInput(name: string, notes: string, rows: EditorRow[]): RecipeInput | null {
  if (!name.trim() || !rows.length) return null
  return {
    name: name.trim(),
    notes: notes.trim() || null,
    items: rows.map((r) =>
      'foodId' in r ? { foodId: r.foodId, grams: r.grams } : toFoodItem({ food: r.food, grams: r.grams }),
    ),
  }
}

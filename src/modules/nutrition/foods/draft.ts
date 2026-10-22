import type { CustomFoodInput, Food } from '../data'

export const FOOD_FIELDS = [
  { key: 'name', label: 'Nome', unit: null, required: true },
  { key: 'brand', label: 'Marca', unit: null, required: false },
  { key: 'barcode', label: 'Codice a barre', unit: null, required: false },
  { key: 'servingSizeG', label: 'Porzione', unit: 'g', required: false },
  { key: 'kcal', label: 'Calorie', unit: 'kcal', required: true },
  { key: 'protein', label: 'Proteine', unit: 'g', required: true },
  { key: 'carbs', label: 'Carboidrati', unit: 'g', required: true },
  { key: 'fat', label: 'Grassi', unit: 'g', required: true },
  { key: 'caffeineMg', label: 'Caffeina', unit: 'mg', required: false },
] as const

export type FoodDraft = Record<keyof CustomFoodInput, string>

export function toFoodDraft(food?: Partial<Food> | null): FoodDraft {
  const v = (x: string | number | null | undefined) => (x == null ? '' : String(x))
  return {
    name: v(food?.name),
    brand: v(food?.brand),
    barcode: v(food?.barcode),
    servingSizeG: v(food?.servingSizeG),
    kcal: v(food?.kcal),
    protein: v(food?.protein),
    carbs: v(food?.carbs),
    fat: v(food?.fat),
    caffeineMg: v(food?.caffeineMg),
  }
}

const number = (s: string) => (s.trim() === '' ? null : Number(s.trim().replace(',', '.')))

// Valori per 100 g: kcal fino a 900, macro fino a 100 g. null se il
// modulo non è valido.
export function toFoodInput(d: FoodDraft): CustomFoodInput | null {
  const name = d.name.trim()
  const kcal = number(d.kcal)
  const protein = number(d.protein)
  const carbs = number(d.carbs)
  const fat = number(d.fat)
  const servingSizeG = number(d.servingSizeG)
  const caffeineMg = number(d.caffeineMg)
  const barcode = d.barcode.trim() || null
  const inRange = (n: number | null, max: number) => n != null && Number.isFinite(n) && n >= 0 && n <= max
  const optional = (n: number | null, max: number) => n == null || inRange(n, max)
  if (!name || !inRange(kcal, 900) || !inRange(protein, 100) || !inRange(carbs, 100) || !inRange(fat, 100)) {
    return null
  }
  if (!optional(servingSizeG, 10_000) || !optional(caffeineMg, 100_000)) return null
  if (barcode && !/^\d{6,14}$/.test(barcode)) return null
  return {
    name,
    brand: d.brand.trim() || null,
    barcode,
    servingSizeG,
    kcal: kcal!,
    protein: protein!,
    carbs: carbs!,
    fat: fat!,
    caffeineMg,
  }
}

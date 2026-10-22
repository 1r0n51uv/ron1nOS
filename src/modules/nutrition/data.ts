import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'
import { mockDelay } from '@/lib/mock'

export type Meal = { name: string; dish: string; kcal: number; eaten: boolean }
export type NutritionToday = { kcalTarget: number; meals: Meal[] }

const mock: NutritionToday = {
  kcalTarget: 2400,
  meals: [
    { name: 'Colazione', dish: 'Yogurt greco e avena', kcal: 420, eaten: true },
    { name: 'Pranzo', dish: 'Riso, pollo e verdure', kcal: 690, eaten: true },
    { name: 'Spuntino', dish: 'Mela e mandorle', kcal: 200, eaten: true },
    { name: 'Cena', dish: 'Salmone e patate', kcal: 740, eaten: false },
  ],
}

// Mock: da sostituire con la chiamata all'API pasti.
export function getNutritionToday() {
  return mockDelay(mock)
}

export function useNutrition() {
  return useQuery({ queryKey: ['nutrition', 'today'], queryFn: getNutritionToday })
}

export function kcalEaten(n: NutritionToday) {
  return n.meals.filter((m) => m.eaten).reduce((sum, m) => sum + m.kcal, 0)
}

export function nextMeal(n: NutritionToday) {
  return n.meals.find((m) => !m.eaten)
}

// Obiettivo nutrizionale (NUT-015, GET/POST /api/v1/nutrition/goals).
export type Goal = {
  id: string
  source: 'manual' | 'yazio'
  kcal: number
  protein: number // g
  carbs: number // g
  fat: number // g
  waterMl: number | null
  effectiveFrom: string // YYYY-MM-DD
}

export type Goals = { current: Goal | null; history: Goal[]; editable: boolean }

export type GoalInput = Pick<Goal, 'kcal' | 'protein' | 'carbs' | 'fat' | 'waterMl'>

export const goalsSource = {
  get: () => api.get<Goals>('/nutrition/goals'),
  save: (input: GoalInput) => api.post<Goal>('/nutrition/goals', input),
}

export function useGoals() {
  return useQuery({ queryKey: ['nutrition', 'goals'], queryFn: () => goalsSource.get() })
}

export function useSaveGoal() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: GoalInput) => goalsSource.save(input),
    onSuccess: () => client.invalidateQueries({ queryKey: ['nutrition'] }),
  })
}

// Giorno del diario (GET /api/v1/nutrition/day, NUT-002).
export type SlotId = 'breakfast' | 'morning_snack' | 'lunch' | 'afternoon_snack' | 'dinner'

export const SLOT_LABELS: Record<SlotId, string> = {
  breakfast: 'Colazione',
  morning_snack: 'Spuntino',
  lunch: 'Pranzo',
  afternoon_snack: 'Merenda',
  dinner: 'Cena',
}

export type Macros = { kcal: number; protein: number; carbs: number; fat: number }

export type SyncState = 'local' | 'pending' | 'synced' | 'error' | 'unmatched'

export type MealItem = Macros & {
  id: string
  foodId: string | null
  name: string
  grams: number
  origin: 'ron1nos' | 'yazio'
  sync: SyncState
}

export type PlannedItem = Macros & { foodId: string | null; name: string; grams: number }

export type SlotDay = {
  slot: SlotId
  state: 'empty' | 'planned' | 'eaten' | 'skipped'
  meal: (Macros & { id: string; items: MealItem[] }) | null
  planned:
    | (Macros & {
        id: string
        status: 'planned' | 'eaten' | 'skipped'
        recipeId: string | null
        recipeName: string | null
        templateName: string | null
        items: PlannedItem[]
      })
    | null
}

export type Day = {
  date: string
  goal: (Pick<Goal, 'kcal' | 'protein' | 'carbs' | 'fat'> & { waterMl: number | null }) | null
  totals: Macros
  plannedKcal: number
  slots: SlotDay[]
}

export const daySource = {
  get: (date: string) => api.get<Day>(`/nutrition/day?date=${date}`),
}

export function useDay(date: string) {
  return useQuery({
    queryKey: ['nutrition', 'day', date],
    queryFn: () => daySource.get(date),
  })
}

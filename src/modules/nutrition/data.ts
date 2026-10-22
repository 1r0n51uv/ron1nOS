import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'

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
  // Lo slot dell'ora corrente, solo per oggi (NUT-003).
  suggestedSlot: SlotId | null
  // Il prossimo pasto da segnare, solo per oggi (NUT-001).
  nextSlot: SlotId | null
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

// Ricerca alimenti (GET /api/v1/nutrition/foods/search, NUT-004). Valori
// per 100 g; `id` c'è solo per gli alimenti già nel catalogo.
export type FoodSource = 'custom' | 'openfoodfacts' | 'usda' | 'yazio'

export type Food = {
  id: string | null
  source: FoodSource
  externalId: string | null
  name: string
  brand: string | null
  barcode: string | null
  servingSizeG: number | null
  kcal: number
  protein: number
  carbs: number
  fat: number
  caffeineMg: number | null
  yazioProductId: string | null
}

export type FoodSearch = { results: Food[]; unavailable: Exclude<FoodSource, 'custom'>[] }

export const foodsSource = {
  search: (q: string, italy: boolean) =>
    api.get<FoodSearch>(`/nutrition/foods/search?q=${encodeURIComponent(q)}${italy ? '' : '&italy=0'}`),
}

// Sotto i 2 caratteri non si cerca.
export function useFoodSearch(q: string, italy: boolean) {
  const query = q.trim()
  return useQuery({
    queryKey: ['nutrition', 'foods', query, italy],
    queryFn: () => foodsSource.search(query, italy),
    enabled: query.length >= 2,
    staleTime: 60_000,
  })
}

// Registrare un pasto (POST /api/v1/nutrition/meals, NUT-003): un alimento
// del catalogo per id, uno esterno con i suoi valori.
export type MealInput = {
  date: string
  slot: SlotId
  items: ({ foodId: string; grams: number } | { food: Omit<Food, 'id'>; grams: number })[]
}

export const mealsSource = {
  log: (input: MealInput) => api.post<Day>('/nutrition/meals', input),
}

export function useLogMeal() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: MealInput) => mealsSource.log(input),
    onSuccess: (day) => {
      client.setQueryData(['nutrition', 'day', day.date], day)
      return client.invalidateQueries({ queryKey: ['nutrition'] })
    },
  })
}

// Alimenti personali (/api/v1/nutrition/foods, NUT-006). Valori per 100 g.
export type CustomFoodInput = Pick<
  Food,
  'name' | 'brand' | 'barcode' | 'servingSizeG' | 'kcal' | 'protein' | 'carbs' | 'fat' | 'caffeineMg'
>

export const customFoodsSource = {
  list: () => api.get<{ foods: Food[] }>('/nutrition/foods'),
  create: (input: CustomFoodInput) => api.post<Food>('/nutrition/foods', input),
  update: (id: string, input: Partial<CustomFoodInput>) => api.patch<Food>(`/nutrition/foods/${id}`, input),
  remove: (id: string) => api.delete<void>(`/nutrition/foods/${id}`),
}

export function useCustomFoods() {
  return useQuery({ queryKey: ['nutrition', 'custom-foods'], queryFn: () => customFoodsSource.list() })
}

function useFoodMutation<A, R>(fn: (args: A) => Promise<R>) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => client.invalidateQueries({ queryKey: ['nutrition'] }),
  })
}

export const useCreateFood = () =>
  useFoodMutation((input: CustomFoodInput) => customFoodsSource.create(input))
export const useUpdateFood = () =>
  useFoodMutation(({ id, input }: { id: string; input: Partial<CustomFoodInput> }) =>
    customFoodsSource.update(id, input),
  )
export const useDeleteFood = () => useFoodMutation((id: string) => customFoodsSource.remove(id))

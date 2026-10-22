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
  items: (
    | { foodId: string; grams: number }
    | { food: Omit<Food, 'id'>; grams: number }
    | { recipeId: string; factor: number }
  )[]
}

export const mealsSource = {
  log: (input: MealInput) => api.post<Day>('/nutrition/meals', input),
  // Correggere un pasto (NUT-007).
  removeItem: (id: string) => api.delete<Day>(`/nutrition/meals/items/${id}`),
  setGrams: (id: string, grams: number) => api.patch<Day>(`/nutrition/meals/items/${id}`, { grams }),
}

// Le scritture sul diario rispondono con il giorno aggiornato.
function useDayMutation<A>(fn: (args: A) => Promise<Day>) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (day) => {
      client.setQueryData(['nutrition', 'day', day.date], day)
      return client.invalidateQueries({ queryKey: ['nutrition'] })
    },
  })
}

// Pianificare un pasto (/api/v1/nutrition/plans, NUT-009).
export type PlanStatus = 'planned' | 'eaten' | 'skipped'

export const plansSource = {
  set: (input: MealInput) => api.put<Day>('/nutrition/plans', input),
  remove: (id: string) => api.delete<Day>(`/nutrition/plans/${id}`),
  status: (id: string, status: PlanStatus) => api.put<Day>(`/nutrition/plans/${id}/status`, { status }),
}

export const useSetPlan = () => useDayMutation((input: MealInput) => plansSource.set(input))
export const useDeletePlan = () => useDayMutation((id: string) => plansSource.remove(id))
export const useSetPlanStatus = () =>
  useDayMutation(({ id, status }: { id: string; status: PlanStatus }) => plansSource.status(id, status))

export const useLogMeal = () => useDayMutation((input: MealInput) => mealsSource.log(input))
export const useRemoveItem = () => useDayMutation((id: string) => mealsSource.removeItem(id))
export const useSetGrams = () =>
  useDayMutation(({ id, grams }: { id: string; grams: number }) => mealsSource.setGrams(id, grams))

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

// Codice a barre (GET /api/v1/nutrition/foods/barcode/{code}, NUT-005).
export type BarcodeResult = { food: Food | null; unavailable: Exclude<FoodSource, 'custom'>[] }

export const barcodeSource = {
  find: (code: string) => api.get<BarcodeResult>(`/nutrition/foods/barcode/${encodeURIComponent(code)}`),
}

export function useBarcode(code: string | null) {
  return useQuery({
    queryKey: ['nutrition', 'barcode', code],
    queryFn: () => barcodeSource.find(code!),
    enabled: !!code,
  })
}

// Ricette (/api/v1/nutrition/recipes, NUT-008): kcal e macro dagli alimenti
// di oggi. `missing`: l'alimento è stato eliminato e non conta.
export type RecipeItem = Macros & {
  id: string
  foodId: string | null
  name: string
  grams: number
  missing: boolean
}

export type Recipe = Macros & {
  id: string
  name: string
  notes: string | null
  grams: number
  items: RecipeItem[]
}

export type RecipeInput = {
  name: string
  notes: string | null
  items: ({ foodId: string; grams: number } | { food: Omit<Food, 'id'>; grams: number })[]
}

export const recipesSource = {
  list: () => api.get<{ recipes: Recipe[] }>('/nutrition/recipes'),
  create: (input: RecipeInput) => api.post<Recipe>('/nutrition/recipes', input),
  update: (id: string, input: RecipeInput) => api.put<Recipe>(`/nutrition/recipes/${id}`, input),
  remove: (id: string) => api.delete<void>(`/nutrition/recipes/${id}`),
}

export function useRecipes() {
  return useQuery({ queryKey: ['nutrition', 'recipes'], queryFn: () => recipesSource.list() })
}

export const useSaveRecipe = () =>
  useFoodMutation(({ id, input }: { id?: string; input: RecipeInput }) =>
    id ? recipesSource.update(id, input) : recipesSource.create(input),
  )
export const useDeleteRecipe = () => useFoodMutation((id: string) => recipesSource.remove(id))

// Template settimanali (/api/v1/nutrition/templates, NUT-010). `weekday` da
// 1 (lunedì) a 7; `dayKcal` le kcal di ogni giorno.
export type TemplateCell = {
  weekday: number
  slot: SlotId
  recipeId: string | null
  foodId: string | null
  grams: number | null
  name: string
  kcal: number
}

export type Template = { id: string; name: string; cells: TemplateCell[]; dayKcal: number[] }

export type TemplateCellInput = { weekday: number; slot: SlotId } & (
  { recipeId: string } | { foodId: string; grams: number } | { food: Omit<Food, 'id'>; grams: number }
)

export type TemplateInput = { name: string; cells: TemplateCellInput[] }

export type ApplyResult = { created: number; replaced: number; kept: number }

export const templatesSource = {
  list: () => api.get<{ templates: Template[] }>('/nutrition/templates'),
  create: (input: TemplateInput) => api.post<Template>('/nutrition/templates', input),
  update: (id: string, input: TemplateInput) => api.put<Template>(`/nutrition/templates/${id}`, input),
  remove: (id: string) => api.delete<void>(`/nutrition/templates/${id}`),
  apply: (id: string, monday: string) =>
    api.post<ApplyResult>(`/nutrition/templates/${id}/apply`, { monday }),
}

export function useTemplates() {
  return useQuery({ queryKey: ['nutrition', 'templates'], queryFn: () => templatesSource.list() })
}

export const useSaveTemplate = () =>
  useFoodMutation(({ id, input }: { id?: string; input: TemplateInput }) =>
    id ? templatesSource.update(id, input) : templatesSource.create(input),
  )
export const useDeleteTemplate = () => useFoodMutation((id: string) => templatesSource.remove(id))
export const useApplyTemplate = () =>
  useFoodMutation(({ id, monday }: { id: string; monday: string }) => templatesSource.apply(id, monday))

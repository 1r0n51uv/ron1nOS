// Il giorno del diario (NUT-001, NUT-002): i 5 slot con il loro stato,
// i totali mangiati e il pianificato, rispetto all'obiettivo del giorno.
import type { Queryable } from '../db.ts'
import { activityOf } from './fromyazio.ts'
import { goalFor } from './goals.ts'
import type { Quota } from './quota.ts'
import { quotaFor } from './quota.ts'
import type { Slot } from './schemas.ts'
import { SLOTS } from './schemas.ts'
import type { DaySupplement } from './supplements.ts'
import { daySupplements } from './supplements.ts'

export type Macros = { kcal: number; protein: number; carbs: number; fat: number }

export type MealItem = Macros & {
  id: string
  foodId: string | null
  name: string
  grams: number
  origin: 'ron1nos' | 'yazio'
  sync: 'local' | 'pending' | 'synced' | 'error' | 'unmatched'
}

// Stato verso YAZIO (NUT-023): inviata se YAZIO ne sa la stessa versione,
// altrimenti in coda; errore e senza equivalente li decide l'invio. Senza
// YAZIO in uso le righe in coda diventano local nella vista del giorno.
const SYNC_STATE = `case
    when f.yazio_matched_by = 'local' then 'local'
    when i.yazio_sync in ('error', 'unmatched') then i.yazio_sync::text
    when i.yazio_amount = i.quantity_g and i.yazio_daytime =
      (case when e.slot in ('morning_snack', 'afternoon_snack') then 'snack' else e.slot::text end) then 'synced'
    else 'pending' end`

export type PlannedItem = Macros & { foodId: string | null; name: string; grams: number }

export type SlotDay = {
  slot: Slot
  // vuoto, pianificato, mangiato; saltato è un piano segnato come non mangiato.
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
  goal: { kcal: number; protein: number; carbs: number; fat: number; waterMl: number | null } | null
  // Le kcal da mangiare nel giorno (NUT-016): obiettivo più attività. null
  // senza obiettivo.
  quota: Quota | null
  totals: Macros
  // Kcal pianificate e non ancora mangiate.
  plannedKcal: number
  slots: SlotDay[]
  // Acqua bevuta nel giorno (NUT-012).
  waterMl: number
  // Caffeina del giorno (NUT-013): voci del contatore più gli alimenti
  // registrati che ne hanno.
  caffeine: { totalMg: number; mealsMg: number }
  // La checklist degli integratori del giorno (NUT-014).
  supplements: DaySupplement[]
}

const zero = (): Macros => ({ kcal: 0, protein: 0, carbs: 0, fat: 0 })

export function sum(items: Macros[]): Macros {
  const t = items.reduce(
    (a, i) => ({
      kcal: a.kcal + i.kcal,
      protein: a.protein + i.protein,
      carbs: a.carbs + i.carbs,
      fat: a.fat + i.fat,
    }),
    zero(),
  )
  return round(t)
}

// Kcal intere, macro a un decimale: come le mostrano i client.
export function round(m: Macros): Macros {
  const r1 = (n: number) => Math.round(n * 10) / 10
  return { kcal: Math.round(m.kcal), protein: r1(m.protein), carbs: r1(m.carbs), fat: r1(m.fat) }
}

// Kcal e macro di una quantità a partire dai valori per 100 g.
export function macrosFor(
  food: {
    calories_per_100g: number
    protein_g_per_100g: number
    carbs_g_per_100g: number
    fat_g_per_100g: number
  },
  grams: number,
): Macros {
  const f = grams / 100
  return {
    kcal: food.calories_per_100g * f,
    protein: food.protein_g_per_100g * f,
    carbs: food.carbs_g_per_100g * f,
    fat: food.fat_g_per_100g * f,
  }
}

export async function getDay(db: Queryable, date: string): Promise<Day> {
  const [goal, activity, items, planned, water, caffeine, supplements] = await Promise.all([
    goalFor(db, date),
    activityOf(db, date),
    db.query<MealItem & { slot: Slot; mealId: string }>(
      `select i.id, i.food_id as "foodId", i.food_name as name, i.quantity_g as grams, i.calories as kcal,
              i.protein_g as protein, i.carbs_g as carbs, i.fat_g as fat, i.origin, ${SYNC_STATE} as sync,
              e.slot, e.id as "mealId"
         from meal_entry_items i join meal_entries e on e.id = i.meal_entry_id
         left join foods f on f.id = i.food_id
        where e.day = $1 order by i.order_index, i.created_at`,
      [date],
    ),
    db.query<{
      id: string
      slot: Slot
      status: 'planned' | 'eaten' | 'skipped'
      recipeId: string | null
      recipeName: string | null
      templateName: string | null
      foodId: string | null
      name: string | null
      grams: number | null
      kcal100: number | null
      protein100: number | null
      carbs100: number | null
      fat100: number | null
    }>(
      `select p.id, p.slot, p.status, p.recipe_id as "recipeId", r.name as "recipeName", t.name as "templateName",
              pi.food_id as "foodId", pi.food_name as name, pi.quantity_g as grams,
              f.calories_per_100g as kcal100, f.protein_g_per_100g as protein100,
              f.carbs_g_per_100g as carbs100, f.fat_g_per_100g as fat100
         from planned_meals p
         left join recipes r on r.id = p.recipe_id
         left join diet_templates t on t.id = p.template_id
         left join planned_meal_items pi on pi.planned_meal_id = p.id
         left join foods f on f.id = pi.food_id
        where p.day = $1 order by p.created_at, pi.order_index`,
      [date],
    ),
    db.query<{ ml: number }>('select coalesce(sum(amount_ml), 0) as ml from water_logs where day = $1', [
      date,
    ]),
    db.query<{ logged: number; meals: number }>(
      `select (select coalesce(sum(caffeine_mg), 0) from caffeine_logs where day = $1) as logged,
              (select coalesce(sum(i.caffeine_mg), 0) from meal_entry_items i
                 join meal_entries e on e.id = i.meal_entry_id where e.day = $1) as meals`,
      [date],
    ),
    daySupplements(db, date),
  ])

  const slots: SlotDay[] = SLOTS.map((slot) => {
    const mine = items.rows.filter((i) => i.slot === slot)
    const meal = mine.length
      ? {
          id: mine[0].mealId,
          ...sum(mine),
          items: mine.map(({ slot: _s, mealId: _m, ...i }) => ({ ...i, ...round(i) })),
        }
      : null

    const rows = planned.rows.filter((p) => p.slot === slot)
    const plannedItems: PlannedItem[] = rows
      .filter((r) => r.name !== null && r.grams !== null)
      .map((r) => ({
        foodId: r.foodId,
        name: r.name as string,
        grams: r.grams as number,
        ...round(
          macrosFor(
            {
              calories_per_100g: r.kcal100 ?? 0,
              protein_g_per_100g: r.protein100 ?? 0,
              carbs_g_per_100g: r.carbs100 ?? 0,
              fat_g_per_100g: r.fat100 ?? 0,
            },
            r.grams as number,
          ),
        ),
      }))
    const p = rows[0]
    const plan = p
      ? {
          id: p.id,
          status: p.status,
          recipeId: p.recipeId,
          recipeName: p.recipeName,
          templateName: p.templateName,
          ...sum(plannedItems),
          items: plannedItems,
        }
      : null

    const state: SlotDay['state'] = meal
      ? 'eaten'
      : plan?.status === 'planned'
        ? 'planned'
        : plan?.status === 'skipped'
          ? 'skipped'
          : 'empty'
    return { slot, state, meal, planned: plan }
  })

  return {
    date,
    goal: goal && {
      kcal: goal.kcal,
      protein: goal.protein,
      carbs: goal.carbs,
      fat: goal.fat,
      waterMl: goal.waterMl,
    },
    quota: goal && quotaFor(goal.kcal, activity),
    totals: sum(slots.flatMap((s) => (s.meal ? [s.meal] : []))),
    plannedKcal: slots.reduce((a, s) => a + (s.state === 'planned' ? (s.planned?.kcal ?? 0) : 0), 0),
    slots,
    waterMl: Math.round(water.rows[0].ml),
    caffeine: {
      totalMg: Math.round(caffeine.rows[0].logged + caffeine.rows[0].meals),
      mealsMg: Math.round(caffeine.rows[0].meals),
    },
    supplements,
  }
}

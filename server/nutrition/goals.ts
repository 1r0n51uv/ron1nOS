// Obiettivo nutrizionale (NUT-015): kcal, macro e acqua. Solo aggiunte:
// ogni cambio inserisce una riga con la data di inizio e l'obiettivo di un
// giorno è la riga più recente iniziata entro quel giorno (ADR-0019).
import type { Queryable } from '../db.ts'

export type GoalSource = 'manual' | 'yazio'

export type Goal = {
  id: string
  source: GoalSource
  kcal: number
  protein: number
  carbs: number
  fat: number
  waterMl: number | null
  effectiveFrom: string
}

export type NewGoal = Omit<Goal, 'id'>

const COLUMNS = `id, source, calories_target as kcal, protein_g_target as protein, carbs_g_target as carbs,
  fat_g_target as fat, water_ml_target as "waterMl", effective_from as "effectiveFrom"`

export async function goalFor(db: Queryable, day: string): Promise<Goal | null> {
  const { rows } = await db.query<Goal>(
    `select ${COLUMNS} from nutrition_goals where effective_from <= $1
      order by effective_from desc, created_at desc limit 1`,
    [day],
  )
  return rows[0] ?? null
}

export async function goalHistory(db: Queryable, limit = 50): Promise<Goal[]> {
  const { rows } = await db.query<Goal>(
    `select ${COLUMNS} from nutrition_goals order by effective_from desc, created_at desc limit $1`,
    [limit],
  )
  return rows
}

// Obiettivi validi in un intervallo di giorni, per il report (NUT-017).
export async function goalsBetween(db: Queryable, from: string, to: string): Promise<Map<string, Goal>> {
  const { rows } = await db.query<Goal & { day: string }>(
    `select d::date::text as day, g.*
       from generate_series($1::date, $2::date, interval '1 day') d
       cross join lateral (
         select ${COLUMNS} from nutrition_goals
          where effective_from <= d::date order by effective_from desc, created_at desc limit 1
       ) g`,
    [from, to],
  )
  return new Map(rows.map(({ day, ...g }) => [day, g]))
}

export async function addGoal(db: Queryable, goal: NewGoal): Promise<Goal> {
  const { rows } = await db.query<Goal>(
    `insert into nutrition_goals (source, calories_target, protein_g_target, carbs_g_target, fat_g_target,
       water_ml_target, effective_from)
     values ($1, $2, $3, $4, $5, $6, $7) returning ${COLUMNS}`,
    [goal.source, goal.kcal, goal.protein, goal.carbs, goal.fat, goal.waterMl, goal.effectiveFrom],
  )
  return rows[0]
}

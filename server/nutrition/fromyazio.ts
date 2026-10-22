// Dati che arrivano da YAZIO a ogni giro (NUT-024): obiettivo (NUT-015),
// energia attiva del giorno (NUT-016) e pesate (NUT-017). Qui ron1nOS non
// li modifica: si cambiano nell'app YAZIO.
import type { Queryable } from '../db.ts'
import type { Goals } from '../yazio/schemas.ts'
import { addDays } from './dates.ts'
import type { Goal } from './goals.ts'
import { addGoal, goalFor } from './goals.ts'
import type { SyncStep } from './yazio.ts'

// Al primo giro si importa lo storico delle pesate di questi giorni.
const WEIGHT_HISTORY_DAYS = 5 * 365
// Poi si rilegge l'ultima settimana, per le pesate corrette o aggiunte dopo.
const WEIGHT_OVERLAP_DAYS = 7

const round1 = (n: number) => Math.round(n * 10) / 10

function fromGoals(g: Goals) {
  return {
    kcal: round1(g['energy.energy']),
    protein: round1(g['nutrient.protein']),
    carbs: round1(g['nutrient.carb']),
    fat: round1(g['nutrient.fat']),
    waterMl: g.water == null ? null : round1(g.water),
  }
}

const same = (a: Goal, b: ReturnType<typeof fromGoals>) =>
  a.source === 'yazio' &&
  a.kcal === b.kcal &&
  a.protein === b.protein &&
  a.carbs === b.carbs &&
  a.fat === b.fat &&
  a.waterMl === b.waterMl

// Un obiettivo cambiato in YAZIO apre una riga nuova con la data del giorno.
export const readGoal: SyncStep = async ({ db, client, day }) => {
  const goal = fromGoals(await client.goals(day))
  const current = await goalFor(db, day)
  if (current && same(current, goal)) return
  await addGoal(db, { source: 'yazio', effectiveFrom: day, ...goal })
}

// Oggi e ieri: un'attività registrata in ritardo entra lo stesso.
export const readActivity: SyncStep = async ({ db, client, day }) => {
  for (const d of [addDays(day, -1), day]) {
    const s = await client.dailySummary(d)
    await db.query(
      `insert into day_activity (day, active_kcal, counted) values ($1, $2, $3)
       on conflict (day) do update set active_kcal = excluded.active_kcal, counted = excluded.counted,
         updated_at = now()`,
      [d, round1(s.activity_energy), s.consume_activity_energy],
    )
  }
}

export const readWeights: SyncStep = async ({ db, client, day }) => {
  const { rows } = await db.query<{ last: string | null }>(
    `select max(day) as last from body_weights where source = 'yazio'`,
  )
  const last = rows[0]?.last
  const start = last ? addDays(last, -WEIGHT_OVERLAP_DAYS) : addDays(day, -WEIGHT_HISTORY_DAYS)
  for (const w of await client.weightHistory(start, day)) {
    await db.query(
      `insert into body_weights (day, source, weight_kg) values ($1, 'yazio', $2)
       on conflict (day, source) do update set weight_kg = excluded.weight_kg`,
      [w.date.slice(0, 10), w.value],
    )
  }
}

export const READ_FROM_YAZIO: SyncStep[] = [readGoal, readActivity, readWeights]

// Il peso di riferimento: Salute quando ci sarà (NUT-018), finora YAZIO.
export async function latestWeight(db: Queryable): Promise<{ day: string; kg: number } | null> {
  const { rows } = await db.query<{ day: string; kg: number }>(
    `select day, weight_kg as kg from body_weights order by day desc, (source = 'health') desc limit 1`,
  )
  return rows[0] ?? null
}

export async function activityOf(db: Queryable, day: string) {
  const { rows } = await db.query<{ kcal: number; counted: boolean }>(
    'select active_kcal as kcal, counted from day_activity where day = $1',
    [day],
  )
  return rows[0] ?? null
}

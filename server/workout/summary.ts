// Riepilogo del modulo Allenamento (GYM-013, per widget e pagina): ultimo
// allenamento, allenamenti questa settimana, giorni di fila e allenamenti
// per settimana sulle ultime 26 settimane. Si calcola a ogni richiesta.
import type { Queryable } from '../db.ts'
import { addDays, mondayOf, today as todayIn } from '../nutrition/dates.ts'
import type { Catalog } from './catalog.ts'
import type { ExerciseImage } from './images.ts'
import { exerciseImages } from './images.ts'
import { streakDays, workoutsThisWeek } from './math.ts'

export const SUMMARY_WEEKS = 26

export type WorkoutSummary = {
  today: string
  last: {
    id: string
    day: string
    routine: string
    startedAt: string
    durationSeconds: number | null
    // Il primo esercizio della sessione, con la sua immagine (GYM-014).
    exercise: { name: string; image: ExerciseImage | null } | null
  } | null
  thisWeek: number
  streakDays: number
  // Dalla più vecchia alla settimana corrente, che è l'ultima.
  weeks: { monday: string; count: number }[]
}

export async function getSummary(
  db: Queryable,
  catalog: Catalog | undefined,
  now: Date,
): Promise<WorkoutSummary> {
  const today = todayIn(now)
  const monday = mondayOf(today)
  const firstMonday = addDays(monday, -7 * (SUMMARY_WEEKS - 1))

  const [lastRows, recent, streak] = await Promise.all([
    db.query<{ id: string; day: string; routine: string; started_at: Date; duration_seconds: number | null }>(
      `select id, day, routine, started_at, duration_seconds from workout_sessions
        where day <= $1 order by started_at desc, day desc limit 1`,
      [today],
    ),
    // Una riga per sessione: due nello stesso giorno contano due.
    db.query<{ day: string }>(`select day from workout_sessions where day between $1 and $2`, [
      firstMonday,
      today,
    ]),
    // Giorni distinti a ritroso: la serie si ferma al primo buco.
    db.query<{ day: string }>(
      `select distinct day from workout_sessions where day <= $1 order by day desc limit 1000`,
      [today],
    ),
  ])

  const days = recent.rows.map((r) => r.day)
  const counts = new Map<string, number>()
  for (const d of days) counts.set(mondayOf(d), (counts.get(mondayOf(d)) ?? 0) + 1)
  const weeks = Array.from({ length: SUMMARY_WEEKS }, (_, i) => {
    const m = addDays(firstMonday, 7 * i)
    return { monday: m, count: counts.get(m) ?? 0 }
  })

  const row = lastRows.rows[0]
  let last: WorkoutSummary['last'] = null
  if (row) {
    const { rows: first } = await db.query<{ exercise_name: string; exercise_key: string }>(
      `select exercise_name, exercise_key from workout_sets where session_id = $1
        order by exercise_order, set_index limit 1`,
      [row.id],
    )
    const ex = first[0]
    const image = ex ? (await exerciseImages(db, catalog, [ex.exercise_key])).get(ex.exercise_key) : null
    last = {
      id: row.id,
      day: row.day,
      routine: row.routine,
      startedAt: row.started_at.toISOString(),
      durationSeconds: row.duration_seconds,
      exercise: ex ? { name: ex.exercise_name, image: image ?? null } : null,
    }
  }

  return {
    today,
    last,
    thisWeek: workoutsThisWeek(days, today),
    streakDays: streakDays(
      streak.rows.map((r) => r.day),
      today,
    ),
    weeks,
  }
}

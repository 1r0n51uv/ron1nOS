// Pagina di un esercizio (GYM-008): testata con tre numeri, i punti dei
// grafici nel periodo scelto e le ultime 3 volte.
import type { Queryable } from '../db.ts'
import { addDays, today as todayIn } from '../nutrition/dates.ts'
import { NotFoundError } from '../nutrition/http.ts'
import type { Catalog } from './catalog.ts'
import type { ExerciseImage } from './images.ts'
import { exerciseImages } from './images.ts'
import type { SetLike } from './math.ts'
import { bestEstimated1RM, isTimed, volume, workingSets } from './math.ts'

export const RANGES = { '3m': 91, '6m': 182, '1y': 365, all: null } as const
export type ExerciseRange = keyof typeof RANGES

// Le ultime volte sotto il grafico.
export const RECENT_SESSIONS = 3

type SetOut = { warmup: boolean; weightKg: number; reps: number | null; durationSeconds: number | null }

export type ExerciseDetail = {
  name: string
  key: string
  image: ExerciseImage | null
  group: string | null
  timed: boolean
  // Su tutto lo storico.
  best1RMKg: number | null
  heaviestKg: number | null
  bestDurationSeconds: number | null
  sessions: number
  range: ExerciseRange
  // Una per sessione nel periodo, dalla meno recente.
  points: {
    sessionId: string
    day: string
    best1RMKg: number
    volumeKg: number
    bestDurationSeconds: number
    totalDurationSeconds: number
  }[]
  // Dalla più recente.
  recent: { sessionId: string; day: string; best1RMKg: number | null; sets: SetOut[] }[]
}

type Row = {
  exercise_name: string
  muscle_group: string | null
  session_id: string
  day: string
  is_warmup: boolean
  weight_kg: number
  reps: number | null
  duration_seconds: number | null
}

const toSetLike = (s: Row): SetLike => ({
  isWarmup: s.is_warmup,
  weightKg: s.weight_kg,
  reps: s.reps,
  durationSeconds: s.duration_seconds,
})

const durations = (sets: SetLike[]) => sets.filter((s) => !s.isWarmup).map((s) => s.durationSeconds ?? 0)

export async function getExercise(
  db: Queryable,
  catalog: Catalog | undefined,
  key: string,
  range: ExerciseRange,
  now: Date,
): Promise<ExerciseDetail> {
  const { rows } = await db.query<Row>(
    `select w.exercise_name, e.muscle_group, w.session_id, s.day,
            w.is_warmup, w.weight_kg, w.reps, w.duration_seconds
       from workout_sets w
       join workout_sessions s on s.id = w.session_id
       left join workout_exercises e on e.exercise_key = w.exercise_key
      where w.exercise_key = $1
      order by s.started_at, s.id, w.set_index`,
    [key],
  )
  const last = rows[rows.length - 1]
  if (!last) throw new NotFoundError('Esercizio non trovato')

  const all = rows.map(toSetLike)
  const timed = isTimed(all)
  const working = workingSets(all)
  const best1RM = bestEstimated1RM(working)
  const longest = Math.max(0, ...durations(all))

  const ids = [...new Set(rows.map((r) => r.session_id))]
  const sessions = ids.map((id) => {
    const own = rows.filter((r) => r.session_id === id)
    const sets = own.map(toSetLike)
    const lifted = workingSets(sets)
    const times = durations(sets)
    return {
      sessionId: id,
      day: own[0]!.day,
      best1RMKg: bestEstimated1RM(lifted),
      volumeKg: volume(lifted),
      bestDurationSeconds: Math.max(0, ...times),
      totalDurationSeconds: times.reduce((sum, t) => sum + t, 0),
      sets: own.map((s) => ({
        warmup: s.is_warmup,
        weightKg: s.weight_kg,
        reps: s.reps,
        durationSeconds: s.duration_seconds,
      })),
    }
  })

  const days = RANGES[range]
  const from = days === null ? null : addDays(todayIn(now), -days)
  const images = await exerciseImages(db, catalog, [key])

  return {
    name: last.exercise_name,
    key,
    image: images.get(key) ?? null,
    group: last.muscle_group,
    timed,
    best1RMKg: timed || best1RM === 0 ? null : best1RM,
    heaviestKg: timed || !working.length ? null : Math.max(...working.map((s) => s.weightKg)),
    bestDurationSeconds: timed && longest > 0 ? longest : null,
    sessions: ids.length,
    range,
    points: sessions.filter((s) => from === null || s.day >= from).map(({ sets: _sets, ...point }) => point),
    recent: sessions
      .slice(-RECENT_SESSIONS)
      .reverse()
      .map((s) => ({
        sessionId: s.sessionId,
        day: s.day,
        best1RMKg: s.best1RMKg > 0 ? s.best1RMKg : null,
        sets: s.sets,
      })),
  }
}

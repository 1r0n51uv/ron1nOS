// Esercizi (GYM-007, GYM-009): uno per nome normalizzato, con immagine,
// gruppo, ultima volta e andamento. Si calcola tutto a ogni richiesta dalle
// serie importate: per un solo utente bastano.
import type { Queryable } from '../db.ts'
import type { Catalog } from './catalog.ts'
import type { ExerciseImage } from './images.ts'
import { exerciseImages } from './images.ts'
import { bestEstimated1RM, isTimed, normalizeExercise, workingSets } from './math.ts'
import type { SetLike } from './math.ts'

// Punti della sparkline: le ultime sessioni dell'esercizio.
export const TREND_SESSIONS = 12

export type ExerciseRow = {
  // Il nome come scritto nell'ultima sessione.
  name: string
  key: string
  image: ExerciseImage | null
  group: string | null
  timed: boolean
  // Serie fuori dal riscaldamento.
  sets: number
  sessions: number
  lastDay: string
  // Miglior 1RM stimato o, per gli esercizi a tempo, durata più lunga.
  best1RMKg: number | null
  bestDurationSeconds: number | null
  // Il migliore di ogni sessione, dalla meno recente.
  trend: number[]
}

export type ExerciseSort = 'recent' | 'sets'

type Row = {
  exercise_key: string
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

const bestDuration = (sets: SetLike[]) =>
  sets.reduce((best, s) => (s.isWarmup ? best : Math.max(best, s.durationSeconds ?? 0)), 0)

export async function listExercises(
  db: Queryable,
  catalog: Catalog | undefined,
  { q, sort = 'recent', limit }: { q?: string; sort?: ExerciseSort; limit?: number } = {},
): Promise<ExerciseRow[]> {
  const needle = q ? normalizeExercise(q) : ''
  // Le serie in ordine di sessione, così l'ultima riga di ogni esercizio
  // porta il nome più recente.
  const { rows } = await db.query<Row>(
    `select w.exercise_key, w.exercise_name, e.muscle_group, w.session_id, s.day,
            w.is_warmup, w.weight_kg, w.reps, w.duration_seconds
       from workout_sets w
       join workout_sessions s on s.id = w.session_id
       left join workout_exercises e on e.exercise_key = w.exercise_key
      where $1 = '' or strpos(w.exercise_key, $1) > 0
      order by s.started_at, s.id, w.set_index`,
    [needle],
  )

  const byKey = new Map<string, Row[]>()
  for (const r of rows) {
    const list = byKey.get(r.exercise_key)
    if (list) list.push(r)
    else byKey.set(r.exercise_key, [r])
  }

  const exercises = [...byKey].map(([key, own]) => {
    const last = own[own.length - 1]!
    const timed = isTimed(own.map(toSetLike))
    const sessions = [...new Set(own.map((r) => r.session_id))]
    const trend = sessions.flatMap((id) => {
      const sets = own.filter((r) => r.session_id === id).map(toSetLike)
      const best = timed ? bestDuration(sets) : bestEstimated1RM(workingSets(sets))
      return best > 0 ? [best] : []
    })
    const all = own.map(toSetLike)
    const best1RM = bestEstimated1RM(workingSets(all))
    const longest = bestDuration(all)
    return {
      name: last.exercise_name,
      key,
      group: last.muscle_group,
      timed,
      sets: own.filter((r) => !r.is_warmup).length,
      sessions: sessions.length,
      lastDay: last.day,
      best1RMKg: timed || best1RM === 0 ? null : best1RM,
      bestDurationSeconds: timed && longest > 0 ? longest : null,
      trend: trend.slice(-TREND_SESSIONS),
    }
  })

  // `recent`: dall'ultima volta più recente; `sets`: dai più allenati.
  exercises.sort((a, b) =>
    sort === 'sets'
      ? b.sets - a.sets || b.lastDay.localeCompare(a.lastDay) || a.key.localeCompare(b.key)
      : b.lastDay.localeCompare(a.lastDay) || a.key.localeCompare(b.key),
  )
  const page = limit ? exercises.slice(0, limit) : exercises
  const images = await exerciseImages(
    db,
    catalog,
    page.map((e) => e.key),
  )
  return page.map((e) => ({ ...e, image: images.get(e.key) ?? null }))
}

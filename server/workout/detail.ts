// Dettaglio di una sessione (GYM-005) ed eliminazione (GYM-006).
import type { Queryable } from '../db.ts'
import { NotFoundError } from '../nutrition/http.ts'
import type { Catalog } from './catalog.ts'
import type { ExerciseImage } from './images.ts'
import { exerciseImages } from './images.ts'
import { bestEstimated1RM, isTimed, volume, workingSets } from './math.ts'

export type SessionSet = {
  index: number
  warmup: boolean
  weightKg: number
  reps: number | null
  durationSeconds: number | null
}

export type SessionDetail = {
  id: string
  day: string
  routine: string
  startedAt: string
  durationSeconds: number | null
  // Senza riscaldamento.
  volumeKg: number
  exercises: {
    name: string
    key: string
    image: ExerciseImage | null
    timed: boolean
    volumeKg: number
    // Miglior 1RM stimato mai visto prima di questa sessione (GYM-010).
    record: boolean
    sets: SessionSet[]
  }[]
}

type SetRow = {
  exercise_name: string
  exercise_key: string
  exercise_order: number
  set_index: number
  is_warmup: boolean
  weight_kg: number
  reps: number | null
  duration_seconds: number | null
}

const toSetLike = (s: SetRow) => ({
  isWarmup: s.is_warmup,
  weightKg: s.weight_kg,
  reps: s.reps,
  durationSeconds: s.duration_seconds,
})

export async function getSession(
  db: Queryable,
  catalog: Catalog | undefined,
  id: string,
): Promise<SessionDetail> {
  const { rows } = await db.query<{
    id: string
    day: string
    routine: string
    started_at: Date
    duration_seconds: number | null
  }>(`select id, day, routine, started_at, duration_seconds from workout_sessions where id = $1`, [id])
  const session = rows[0]
  if (!session) throw new NotFoundError('Sessione non trovata')

  const { rows: sets } = await db.query<SetRow>(
    `select exercise_name, exercise_key, exercise_order, set_index, is_warmup, weight_kg, reps, duration_seconds
       from workout_sets where session_id = $1 order by exercise_order, set_index`,
    [id],
  )
  const keys = [...new Set(sets.map((s) => s.exercise_key))]
  // Il miglior 1RM stimato di ogni esercizio nelle sessioni precedenti.
  const { rows: before } = await db.query<SetRow>(
    `select w.exercise_key, w.is_warmup, w.weight_kg, w.reps, w.duration_seconds
       from workout_sets w join workout_sessions s on s.id = w.session_id
      where w.exercise_key = any($1::text[]) and s.started_at < $2 and s.id <> $3`,
    [keys, session.started_at, id],
  )
  const images = await exerciseImages(db, catalog, keys)

  const exercises = keys.map((key) => {
    const own = sets.filter((s) => s.exercise_key === key)
    const working = workingSets(own.map(toSetLike))
    const best = bestEstimated1RM(working)
    const previous = bestEstimated1RM(
      workingSets(before.filter((s) => s.exercise_key === key).map(toSetLike)),
    )
    return {
      name: own[0]!.exercise_name,
      key,
      image: images.get(key) ?? null,
      timed: isTimed(own.map(toSetLike)),
      volumeKg: volume(working),
      record: best > 0 && best > previous,
      sets: own.map((s) => ({
        index: s.set_index,
        warmup: s.is_warmup,
        weightKg: s.weight_kg,
        reps: s.reps,
        durationSeconds: s.duration_seconds,
      })),
    }
  })

  return {
    id: session.id,
    day: session.day,
    routine: session.routine,
    startedAt: session.started_at.toISOString(),
    durationSeconds: session.duration_seconds,
    volumeKg: exercises.reduce((sum, e) => sum + e.volumeKg, 0),
    exercises,
  }
}

// Toglie la sessione e ne ricorda giorno e routine, così un re-import del
// CSV non la riporta (GYM-003). Va chiamata in una transazione.
export async function deleteSession(db: Queryable, id: string) {
  const { rows } = await db.query<{ day: string; routine: string }>(
    `delete from workout_sessions where id = $1 returning day, routine`,
    [id],
  )
  const gone = rows[0]
  if (!gone) throw new NotFoundError('Sessione non trovata')
  await db.query(
    `insert into workout_deleted_sessions (day, routine) values ($1, $2) on conflict do nothing`,
    [gone.day, gone.routine],
  )
}

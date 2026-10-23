// Unione del CSV di Liftin' con lo storico (GYM-003), portata da
// WorkoutImport di 1r0-pkm. Una sessione è giorno più routine; una serie è
// sessione, esercizio normalizzato e numero di serie. Le righe già presenti
// si aggiornano, quelle nuove si aggiungono, un re-import identico non
// scrive nulla. Giorno e routine eliminati (GYM-006) restano fuori.
import type { Queryable } from '../db.ts'
import type { LiftinParse, LiftinRow } from './liftin.ts'
import { normalizeExercise } from './math.ts'

export type ImportSummary = {
  newSessions: number
  updatedSessions: number
  unchangedSessions: number
  // Sessioni eliminate in ron1nOS che il CSV contiene ancora.
  deletedSessions: number
  newSets: number
  updatedSets: number
  // Righe senza data o esercizio.
  skippedRows: number
  from: string
  to: string
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
  perception: number | null
}

type Group = { day: string; routine: string; rows: LiftinRow[] }

// Con apply false calcola solo l'anteprima, con apply true scrive. In
// scrittura va chiamata dentro una transazione.
export async function importLiftin(
  db: Queryable,
  { rows, skipped }: LiftinParse,
  { apply }: { apply: boolean },
): Promise<ImportSummary> {
  const groups = groupRows(rows)
  const days = groups.map((g) => g.day)
  const from = days[0]!
  const to = days[days.length - 1]!

  const [existing, deleted] = await Promise.all([
    db.query<{ id: string; day: string; routine: string; duration_seconds: number | null }>(
      `select id, day, routine, duration_seconds from workout_sessions where day between $1 and $2`,
      [from, to],
    ),
    db.query<{ day: string; routine: string }>(
      `select day, routine from workout_deleted_sessions where day between $1 and $2`,
      [from, to],
    ),
  ])
  const sessionsByKey = new Map(existing.rows.map((s) => [key(s.day, s.routine), s]))
  const deletedKeys = new Set(deleted.rows.map((d) => key(d.day, d.routine)))

  const ids = existing.rows.map((s) => s.id)
  const { rows: oldSets } = await db.query<SetRow & { session_id: string }>(
    `select session_id, exercise_name, exercise_key, exercise_order, set_index, is_warmup, weight_kg,
            reps, duration_seconds, perception
       from workout_sets where session_id = any($1::uuid[])`,
    [ids],
  )
  const setsBySession = new Map<string, Map<string, SetRow>>()
  for (const s of oldSets) {
    const bucket = setsBySession.get(s.session_id) ?? new Map<string, SetRow>()
    bucket.set(setKey(s.exercise_key, s.set_index), s)
    setsBySession.set(s.session_id, bucket)
  }

  const summary: ImportSummary = {
    newSessions: 0,
    updatedSessions: 0,
    unchangedSessions: 0,
    deletedSessions: 0,
    newSets: 0,
    updatedSets: 0,
    skippedRows: skipped,
    from,
    to,
  }

  for (const group of groups) {
    const k = key(group.day, group.routine)
    if (deletedKeys.has(k)) {
      summary.deletedSessions += 1
      continue
    }
    const sets = toSets(group.rows)
    const duration = group.rows.find((r) => r.workoutDurationSeconds !== null)?.workoutDurationSeconds ?? null
    const session = sessionsByKey.get(k)

    if (!session) {
      summary.newSessions += 1
      summary.newSets += sets.length
      if (apply) {
        const startedAt = new Date(Math.min(...group.rows.map((r) => r.startedAt.getTime())))
        const { rows: created } = await db.query<{ id: string }>(
          `insert into workout_sessions (day, routine, started_at, duration_seconds)
           values ($1, $2, $3, $4) returning id`,
          [group.day, group.routine, startedAt, duration],
        )
        await insertSets(db, created[0]!.id, sets)
      }
      continue
    }

    const durationChanged = duration !== null && duration !== session.duration_seconds
    const old = setsBySession.get(session.id) ?? new Map<string, SetRow>()
    const added: SetRow[] = []
    const changed: SetRow[] = []
    for (const s of sets) {
      const prev = old.get(setKey(s.exercise_key, s.set_index))
      if (!prev) added.push(s)
      else if (differs(prev, s)) changed.push(s)
    }
    if (!durationChanged && added.length === 0 && changed.length === 0) {
      summary.unchangedSessions += 1
      continue
    }
    summary.updatedSessions += 1
    summary.newSets += added.length
    summary.updatedSets += changed.length
    if (!apply) continue
    if (durationChanged) {
      await db.query(`update workout_sessions set duration_seconds = $2 where id = $1`, [
        session.id,
        duration,
      ])
    }
    await insertSets(db, session.id, added)
    for (const s of changed) {
      await db.query(
        `update workout_sets
            set exercise_name = $3, exercise_order = $4, is_warmup = $5, weight_kg = $6, reps = $7,
                duration_seconds = $8, perception = $9
          where session_id = $1 and exercise_key = $2 and set_index = $10`,
        [
          session.id,
          s.exercise_key,
          s.exercise_name,
          s.exercise_order,
          s.is_warmup,
          s.weight_kg,
          s.reps,
          s.duration_seconds,
          s.perception,
          s.set_index,
        ],
      )
    }
  }
  return summary
}

function key(day: string, routine: string) {
  return `${day}\u0000${routine}`
}

function setKey(exerciseKey: string, setIndex: number) {
  return `${exerciseKey}\u0000${setIndex}`
}

function groupRows(rows: LiftinRow[]): Group[] {
  const groups = new Map<string, Group>()
  for (const row of rows) {
    const k = key(row.day, row.routine)
    const group = groups.get(k) ?? { day: row.day, routine: row.routine, rows: [] }
    group.rows.push(row)
    groups.set(k, group)
  }
  return [...groups.values()].sort((a, b) => a.day.localeCompare(b.day) || a.routine.localeCompare(b.routine))
}

// Le serie di una sessione, una per esercizio e numero: se il CSV ripete la
// stessa serie vale l'ultima riga. L'ordine degli esercizi è quello della
// loro prima comparsa.
function toSets(rows: LiftinRow[]): SetRow[] {
  const order = new Map<string, number>()
  const sets = new Map<string, SetRow>()
  for (const r of rows) {
    const exerciseKey = normalizeExercise(r.exercise)
    if (!order.has(exerciseKey)) order.set(exerciseKey, order.size + 1)
    sets.set(setKey(exerciseKey, r.setIndex), {
      exercise_name: r.exercise,
      exercise_key: exerciseKey,
      exercise_order: order.get(exerciseKey)!,
      set_index: r.setIndex,
      is_warmup: r.isWarmup,
      weight_kg: r.weightKg,
      reps: r.reps,
      duration_seconds: r.setDurationSeconds,
      perception: r.perception,
    })
  }
  return [...sets.values()]
}

function differs(a: SetRow, b: SetRow) {
  return (
    a.exercise_name !== b.exercise_name ||
    a.exercise_order !== b.exercise_order ||
    a.is_warmup !== b.is_warmup ||
    a.weight_kg !== b.weight_kg ||
    a.reps !== b.reps ||
    a.duration_seconds !== b.duration_seconds ||
    a.perception !== b.perception
  )
}

async function insertSets(db: Queryable, sessionId: string, sets: SetRow[]) {
  if (sets.length === 0) return
  await db.query(
    `insert into workout_sets (session_id, exercise_name, exercise_key, exercise_order, set_index, is_warmup,
                               weight_kg, reps, duration_seconds, perception)
     select $1, x.exercise_name, x.exercise_key, x.exercise_order, x.set_index, x.is_warmup, x.weight_kg,
            x.reps, x.duration_seconds, x.perception
       from jsonb_to_recordset($2::jsonb) as x(exercise_name text, exercise_key text, exercise_order integer,
            set_index integer, is_warmup boolean, weight_kg numeric, reps integer, duration_seconds integer,
            perception numeric)`,
    [sessionId, JSON.stringify(sets)],
  )
}

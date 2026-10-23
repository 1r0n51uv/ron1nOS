// Storico delle sessioni (GYM-004): dalla più recente, a pagine da 20,
// con le miniature dei primi tre esercizi. Filtro per routine.
import type { Queryable } from '../db.ts'
import type { Catalog } from './catalog.ts'
import type { ExerciseImage } from './images.ts'
import { exerciseImages } from './images.ts'

export const PAGE_SIZE = 20

export type SessionRow = {
  id: string
  day: string
  routine: string
  startedAt: string
  durationSeconds: number | null
  // I primi tre esercizi nell'ordine del CSV.
  exercises: { name: string; image: ExerciseImage | null }[]
}

// Il cursore è l'ultima riga della pagina: ora di inizio e id.
export function encodeCursor(startedAt: string, id: string) {
  return Buffer.from(`${startedAt}|${id}`).toString('base64url')
}

export function decodeCursor(cursor: string) {
  const [at, id] = Buffer.from(cursor, 'base64url').toString().split('|')
  if (!at || !id || Number.isNaN(Date.parse(at)) || !/^[0-9a-f-]{36}$/.test(id)) return null
  return { at, id }
}

export async function listSessions(
  db: Queryable,
  catalog: Catalog | undefined,
  { routine, after }: { routine?: string; after?: { at: string; id: string } },
): Promise<{ sessions: SessionRow[]; nextCursor: string | null }> {
  const { rows } = await db.query<{
    id: string
    day: string
    routine: string
    started_at: Date
    duration_seconds: number | null
  }>(
    `select id, day, routine, started_at, duration_seconds from workout_sessions
      where ($1::text is null or routine = $1)
        and ($2::timestamptz is null or (started_at, id) < ($2::timestamptz, $3::uuid))
      order by started_at desc, id desc
      limit $4`,
    [routine ?? null, after?.at ?? null, after?.id ?? null, PAGE_SIZE + 1],
  )
  const page = rows.slice(0, PAGE_SIZE)
  const ids = page.map((r) => r.id)
  const { rows: firsts } = await db.query<{
    session_id: string
    exercise_name: string
    exercise_key: string
  }>(
    `select distinct on (session_id, exercise_order) session_id, exercise_name, exercise_key
       from workout_sets where session_id = any($1::uuid[]) and exercise_order <= 3
      order by session_id, exercise_order, set_index`,
    [ids],
  )
  const images = await exerciseImages(db, catalog, [...new Set(firsts.map((f) => f.exercise_key))])
  const bySession = new Map<string, SessionRow['exercises']>()
  for (const f of firsts) {
    const list = bySession.get(f.session_id) ?? []
    list.push({ name: f.exercise_name, image: images.get(f.exercise_key) ?? null })
    bySession.set(f.session_id, list)
  }
  const last = page.at(-1)
  return {
    sessions: page.map((r) => ({
      id: r.id,
      day: r.day,
      routine: r.routine,
      startedAt: r.started_at.toISOString(),
      durationSeconds: r.duration_seconds,
      exercises: bySession.get(r.id) ?? [],
    })),
    nextCursor: rows.length > PAGE_SIZE && last ? encodeCursor(last.started_at.toISOString(), last.id) : null,
  }
}

// I nomi delle routine per il filtro, dalla più usata di recente.
export async function listRoutines(db: Queryable) {
  const { rows } = await db.query<{ routine: string }>(
    `select routine from workout_sessions where routine <> ''
      group by routine order by max(started_at) desc`,
  )
  return rows.map((r) => r.routine)
}

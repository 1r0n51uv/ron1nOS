// Record personali (GYM-010). Per ogni esercizio: miglior 1RM stimato, peso
// più alto, più ripetizioni a un dato peso, volume più alto in una sessione
// e, per gli esercizi a tempo, durata più lunga. Contano solo le serie
// valide, come nelle altre metriche.
import type { Queryable } from '../db.ts'
import { addDays, today as todayIn } from '../nutrition/dates.ts'
import type { Catalog } from './catalog.ts'
import type { ExerciseImage } from './images.ts'
import { exerciseImages } from './images.ts'
import type { SetLike } from './math.ts'
import { bestEstimated1RM, isTimed, volume, workingSets } from './math.ts'

export type RecordKind = 'e1rm' | 'weight' | 'reps' | 'volume' | 'duration'

export type PersonalRecord = {
  kind: RecordKind
  // kg per e1rm, weight e volume; ripetizioni per reps; secondi per duration.
  value: number
  // Solo per reps: il peso a cui si riferisce.
  weightKg: number | null
  day: string
  sessionId: string
}

export type ExerciseSession = { sessionId: string; day: string; sets: SetLike[] }

// I migliori di una sessione per ogni tipo; reps è una voce per peso.
function bests(sets: SetLike[], timed: boolean) {
  if (timed) {
    const longest = Math.max(0, ...sets.filter((s) => !s.isWarmup).map((s) => s.durationSeconds ?? 0))
    return { single: { duration: longest }, reps: new Map<number, number>() }
  }
  const working = workingSets(sets)
  const reps = new Map<number, number>()
  for (const s of working) reps.set(s.weightKg, Math.max(reps.get(s.weightKg) ?? 0, s.reps))
  return {
    single: {
      e1rm: bestEstimated1RM(working),
      weight: Math.max(0, ...working.map((s) => s.weightKg)),
      volume: volume(working),
    },
    reps,
  }
}

// Scorre le sessioni dalla meno recente: `current` sono i record di oggi,
// `events` le volte in cui una sessione ha battuto un record che c'era già.
// La prima volta di un esercizio, o di un peso, non è un record nuovo.
export function personalRecords(sessions: ExerciseSession[], timed: boolean) {
  const current = new Map<string, PersonalRecord>()
  const events: PersonalRecord[] = []
  for (const s of sessions) {
    const b = bests(s.sets, timed)
    const found: PersonalRecord[] = [
      ...Object.entries(b.single).map(([kind, value]) => ({
        kind: kind as RecordKind,
        value,
        weightKg: null,
      })),
      ...[...b.reps].map(([weightKg, value]) => ({ kind: 'reps' as const, value, weightKg })),
    ].map((r) => ({ ...r, day: s.day, sessionId: s.sessionId }))
    for (const r of found) {
      if (r.value <= 0) continue
      const id = r.kind === 'reps' ? `reps:${r.weightKg}` : r.kind
      const before = current.get(id)
      if (before && r.value <= before.value) continue
      if (before) events.push(r)
      current.set(id, r)
    }
  }
  return { current: [...current.values()], events }
}

type Row = {
  exercise_key: string
  exercise_name: string
  session_id: string
  day: string
  is_warmup: boolean
  weight_kg: number
  reps: number | null
  duration_seconds: number | null
}

// Le serie raggruppate per esercizio e sessione, dalla meno recente.
export async function exerciseSessions(db: Queryable, key?: string) {
  const { rows } = await db.query<Row>(
    `select w.exercise_key, w.exercise_name, w.session_id, s.day,
            w.is_warmup, w.weight_kg, w.reps, w.duration_seconds
       from workout_sets w join workout_sessions s on s.id = w.session_id
      where $1::text is null or w.exercise_key = $1
      order by s.started_at, s.id, w.set_index`,
    [key ?? null],
  )
  const byKey = new Map<string, { name: string; sessions: ExerciseSession[] }>()
  for (const r of rows) {
    const entry = byKey.get(r.exercise_key) ?? { name: r.exercise_name, sessions: [] }
    entry.name = r.exercise_name
    let session = entry.sessions.at(-1)
    if (!session || session.sessionId !== r.session_id) {
      session = { sessionId: r.session_id, day: r.day, sets: [] }
      entry.sessions.push(session)
    }
    session.sets.push({
      isWarmup: r.is_warmup,
      weightKg: r.weight_kg,
      reps: r.reps,
      durationSeconds: r.duration_seconds,
    })
    byKey.set(r.exercise_key, entry)
  }
  return byKey
}

export type RecentRecord = PersonalRecord & {
  exercise: { name: string; key: string; image: ExerciseImage | null }
}

const KIND_ORDER: RecordKind[] = ['e1rm', 'weight', 'volume', 'reps', 'duration']

// I record battuti negli ultimi `days` giorni, dal più recente (GYM-010).
// L'ordine dei tipi decide quale mostrare quando una sessione ne batte più
// d'uno.
export async function recentRecords(
  db: Queryable,
  catalog: Catalog | undefined,
  { days, limit, now }: { days: number; limit: number; now: Date },
): Promise<RecentRecord[]> {
  const from = addDays(todayIn(now), -days)
  const found: (PersonalRecord & { key: string; name: string })[] = []
  for (const [key, { name, sessions }] of await exerciseSessions(db)) {
    const timed = isTimed(sessions.flatMap((s) => s.sets))
    for (const e of personalRecords(sessions, timed).events) {
      if (e.day >= from) found.push({ ...e, key, name })
    }
  }
  found.sort(
    (a, b) =>
      b.day.localeCompare(a.day) ||
      a.key.localeCompare(b.key) ||
      KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind),
  )
  // Una voce per esercizio e sessione, la più importante: tre record della
  // stessa panca non riempiono la sezione.
  const seen = new Set<string>()
  const page = found
    .filter((r) => {
      const id = `${r.key}|${r.sessionId}`
      if (seen.has(id)) return false
      seen.add(id)
      return true
    })
    .slice(0, limit)
  const images = await exerciseImages(db, catalog, [...new Set(page.map((r) => r.key))])
  return page.map(({ key, name, ...r }) => ({
    ...r,
    exercise: { name, key, image: images.get(key) ?? null },
  }))
}

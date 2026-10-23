// Volume per gruppo muscolare (GYM-012): volume e serie valide di ogni
// gruppo, settimana per settimana. Gli esercizi senza gruppo finiscono in
// un gruppo a sé, `null` (Non assegnato).
import type { Queryable } from '../db.ts'
import { addDays, mondayOf, today as todayIn } from '../nutrition/dates.ts'
import { MUSCLE_GROUPS } from './groups.ts'
import type { MuscleGroup } from './groups.ts'
import { workingSets } from './math.ts'

export const DEFAULT_WEEKS = 12

export type GroupWeek = {
  monday: string
  groups: { group: MuscleGroup | null; volumeKg: number; sets: number }[]
}

export async function groupVolume(db: Queryable, { weeks, now }: { weeks: number; now: Date }) {
  const thisMonday = mondayOf(todayIn(now))
  const first = addDays(thisMonday, -7 * (weeks - 1))
  const { rows } = await db.query<{
    day: string
    muscle_group: MuscleGroup | null
    is_warmup: boolean
    weight_kg: number
    reps: number | null
    duration_seconds: number | null
  }>(
    `select s.day, e.muscle_group, w.is_warmup, w.weight_kg, w.reps, w.duration_seconds
       from workout_sets w
       join workout_sessions s on s.id = w.session_id
       left join workout_exercises e on e.exercise_key = w.exercise_key
      where s.day >= $1::date`,
    [first],
  )

  // Settimana → gruppo → totali. `''` sta per Non assegnato.
  const totals = new Map<string, Map<string, { volumeKg: number; sets: number }>>()
  for (const r of rows) {
    const [set] = workingSets([
      { isWarmup: r.is_warmup, weightKg: r.weight_kg, reps: r.reps, durationSeconds: r.duration_seconds },
    ])
    if (!set) continue
    const week = totals.get(mondayOf(r.day)) ?? new Map()
    const group = week.get(r.muscle_group ?? '') ?? { volumeKg: 0, sets: 0 }
    group.volumeKg += set.weightKg * set.reps
    group.sets += 1
    week.set(r.muscle_group ?? '', group)
    totals.set(mondayOf(r.day), week)
  }

  // Nell'ordine dell'elenco fisso, Non assegnato in fondo.
  const order = [...MUSCLE_GROUPS, '']
  const present = order.filter((g) => [...totals.values()].some((w) => w.has(g)))
  const result: GroupWeek[] = Array.from({ length: weeks }, (_, i) => {
    const monday = addDays(first, 7 * i)
    const week = totals.get(monday)
    return {
      monday,
      groups: present.flatMap((g) => {
        const t = week?.get(g)
        return t ? [{ group: (g || null) as MuscleGroup | null, ...t }] : []
      }),
    }
  })
  return { groups: present.map((g) => (g || null) as MuscleGroup | null), weeks: result }
}

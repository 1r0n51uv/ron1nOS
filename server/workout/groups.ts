// Gruppo muscolare di un esercizio (GYM-011): uno dall'elenco fisso, legato
// al nome normalizzato, così sopravvive ai re-import.
import type { Queryable } from '../db.ts'

export const MUSCLE_GROUPS = [
  'petto',
  'schiena',
  'spalle',
  'bicipiti',
  'tricipiti',
  'gambe',
  'glutei',
  'addome',
  'altro',
] as const

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number]

// I muscoli principali di free-exercise-db nei gruppi dell'elenco.
const FROM_CATALOG: Record<string, MuscleGroup> = {
  abdominals: 'addome',
  abductors: 'glutei',
  adductors: 'gambe',
  biceps: 'bicipiti',
  calves: 'gambe',
  chest: 'petto',
  forearms: 'altro',
  glutes: 'glutei',
  hamstrings: 'gambe',
  lats: 'schiena',
  'lower back': 'schiena',
  'middle back': 'schiena',
  neck: 'altro',
  quadriceps: 'gambe',
  shoulders: 'spalle',
  traps: 'schiena',
  triceps: 'tricipiti',
}

// Il gruppo proposto dal primo muscolo principale del catalogo.
export function groupFromMuscles(muscles: string[]): MuscleGroup | null {
  for (const m of muscles) {
    const group = FROM_CATALOG[m.toLowerCase()]
    if (group) return group
  }
  return null
}

export async function setExerciseGroup(db: Queryable, key: string, group: MuscleGroup | null) {
  await db.query(
    `insert into workout_exercises (exercise_key, muscle_group) values ($1, $2)
     on conflict (exercise_key) do update set muscle_group = excluded.muscle_group, updated_at = now()`,
    [key, group],
  )
}

// Quando si sceglie l'immagine il gruppo, se manca, si propone dal catalogo;
// uno già assegnato non cambia.
export async function proposeExerciseGroup(db: Queryable, key: string, group: MuscleGroup | null) {
  if (!group) return
  await db.query(
    `update workout_exercises set muscle_group = $2, updated_at = now()
      where exercise_key = $1 and muscle_group is null`,
    [key, group],
  )
}

export async function exerciseGroup(db: Queryable, key: string) {
  const { rows } = await db.query<{ muscle_group: MuscleGroup | null }>(
    `select muscle_group from workout_exercises where exercise_key = $1`,
    [key],
  )
  return rows[0]?.muscle_group ?? null
}

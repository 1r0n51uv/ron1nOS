// Regole di calcolo del modulo Allenamento (docs/specs/workout.md, Regole
// di calcolo), portate da GymMath e GymStats di 1r0-pkm. Funzioni pure:
// le rotte leggono le serie dal database e chiedono qui i numeri.
import { addDays, mondayOf } from '../nutrition/dates.ts'

export type SetLike = {
  isWarmup: boolean
  weightKg: number
  reps: number | null
  durationSeconds: number | null
}

export type WorkingSet = { weightKg: number; reps: number }

// Chiave dell'esercizio: minuscole, spazi ai lati tolti e spazi interni
// compressi. "Panca  Piana " e "panca piana" sono lo stesso esercizio.
export function normalizeExercise(name: string) {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}

// 1RM stimato con la formula di Epley: peso × (1 + reps / 30). A una
// ripetizione è il peso stesso; reps <= 0 o peso negativo danno 0.
export function epley1RM(weightKg: number, reps: number) {
  if (weightKg < 0 || reps <= 0) return 0
  if (reps === 1) return weightKg
  return weightKg * (1 + reps / 30)
}

// Volume: somma di peso × reps.
export function volume(sets: WorkingSet[]) {
  return sets.reduce((sum, s) => sum + s.weightKg * s.reps, 0)
}

export function bestEstimated1RM(sets: WorkingSet[]) {
  return sets.reduce((best, s) => Math.max(best, epley1RM(s.weightKg, s.reps)), 0)
}

// Serie valide per 1RM, volume e record: non di riscaldamento, con
// ripetizioni e peso maggiore di 0.
export function workingSets(sets: SetLike[]): WorkingSet[] {
  return sets.flatMap((s) =>
    !s.isWarmup && s.weightKg > 0 && s.reps != null && s.reps > 0
      ? [{ weightKg: s.weightKg, reps: s.reps }]
      : [],
  )
}

// Un esercizio è a tempo quando la maggior parte delle sue serie (fuori dal
// riscaldamento) ha una durata e non le ripetizioni.
export function isTimed(sets: SetLike[]) {
  const counted = sets.filter((s) => !s.isWarmup)
  const timed = counted.filter((s) => s.durationSeconds != null && (s.reps == null || s.reps === 0))
  return timed.length > 0 && timed.length * 2 > counted.length
}

// Giorni di fila (GYM-013): giorni di calendario consecutivi con almeno una
// sessione, che finiscono oggi o ieri. `days` sono date `YYYY-MM-DD`.
export function streakDays(days: string[], today: string) {
  const set = new Set(days)
  const yesterday = addDays(today, -1)
  let cursor = set.has(today) ? today : set.has(yesterday) ? yesterday : null
  let count = 0
  while (cursor && set.has(cursor)) {
    count += 1
    cursor = addDays(cursor, -1)
  }
  return count
}

// Allenamenti questa settimana (GYM-013): sessioni da lunedì a oggi. Ogni
// elemento di `days` è una sessione, due nello stesso giorno contano due.
export function workoutsThisWeek(days: string[], today: string) {
  const monday = mondayOf(today)
  return days.filter((d) => d >= monday && d <= today).length
}

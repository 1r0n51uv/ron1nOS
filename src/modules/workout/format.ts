// Testi del modulo Allenamento.
import { num } from '@/lib/format'
import type { FormatTools } from '@/preferences/formats'
import { makeFormats } from '@/preferences/formats'
import { DEFAULT_PREFERENCES } from '../../../server/preferences/schema.ts'

const KG = makeFormats(DEFAULT_PREFERENCES.formats)

// Un peso nell'unità scelta (SET-010), con i decimali solo se servono:
// "92,5", "85". I dati restano in kg.
export function mass(kg: number, fmt: FormatTools = KG) {
  const v = fmt.weight(kg)
  return v % 1
    ? v.toLocaleString('it-IT', { maximumFractionDigits: fmt.weightUnit === 'lb' ? 1 : 2 })
    : String(v)
}

// Un totale arrotondato con l'unità: "12400 kg".
export function massTotal(kg: number, fmt: FormatTools = KG) {
  return `${num(Math.round(fmt.weight(kg)))} ${fmt.weightUnit}`
}

// Un giorno `YYYY-MM-DD` come "19 ott 2026", senza passare dal fuso del browser.
export function dayWithYear(day: string) {
  return new Date(`${day}T12:00:00Z`)
    .toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    .replace('.', '')
}

export function period(from: string, to: string) {
  return from === to ? dayWithYear(from) : `${dayWithYear(from)} – ${dayWithYear(to)}`
}

// "1 allenamento", "3 allenamenti".
export function workouts(n: number) {
  return `${n} ${n === 1 ? 'allenamento' : 'allenamenti'}`
}

// "1 giorno di fila", "4 giorni di fila".
export function streak(n: number) {
  return `${n} ${n === 1 ? 'giorno' : 'giorni'} di fila`
}

// Media degli allenamenti per settimana, con una cifra decimale.
export function weeklyAverage(weeks: { count: number }[]) {
  if (!weeks.length) return 0
  return Math.round((weeks.reduce((s, w) => s + w.count, 0) / weeks.length) * 10) / 10
}

// Il giorno di un allenamento: "oggi", "ieri" o "martedì 20 ottobre".
export function workoutDay(day: string, today: string) {
  const diff = Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${day}T12:00:00Z`)) / 86_400_000)
  if (diff === 0) return 'oggi'
  if (diff === 1) return 'ieri'
  return new Date(`${day}T12:00:00Z`).toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
}

// Durata di un allenamento: "45 min", "1 h 05 min".
export function duration(seconds: number) {
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`
}

// Una serie: "85 × 6", "85,5 × 6", oppure la durata "1:15".
export function setLabel(
  s: { weightKg: number; reps: number | null; durationSeconds: number | null },
  fmt: FormatTools = KG,
) {
  if (s.reps === null && s.durationSeconds !== null) {
    return `${Math.floor(s.durationSeconds / 60)}:${String(s.durationSeconds % 60).padStart(2, '0')}`
  }
  return `${mass(s.weightKg, fmt)} × ${s.reps ?? 0}`
}

// L'ora di inizio nel fuso scelto (SET-010), "18:00".
export function startTime(iso: string, timeZone = KG.timeZone) {
  return new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone })
}

// Il migliore di un esercizio: 1RM stimato "76 kg" o, a tempo, la durata
// più lunga "1:30".
export function exerciseBest(
  e: { best1RMKg: number | null; bestDurationSeconds: number | null },
  fmt: FormatTools = KG,
) {
  if (e.bestDurationSeconds !== null) {
    return setLabel({ weightKg: 0, reps: null, durationSeconds: e.bestDurationSeconds })
  }
  return e.best1RMKg === null ? '–' : `${Math.round(fmt.weight(e.best1RMKg))} ${fmt.weightUnit}`
}

// Gruppi muscolari (GYM-011), nell'ordine dell'elenco fisso.
export const MUSCLE_GROUPS = {
  petto: 'Petto',
  schiena: 'Schiena',
  spalle: 'Spalle',
  bicipiti: 'Bicipiti',
  tricipiti: 'Tricipiti',
  gambe: 'Gambe',
  glutei: 'Glutei',
  addome: 'Addome',
  altro: 'Altro',
} as const

export function groupLabel(group: string | null) {
  return (group && MUSCLE_GROUPS[group as keyof typeof MUSCLE_GROUPS]) || 'Non assegnato'
}

// Durata come "1:30", "12:05".
export function clock(seconds: number) {
  return setLabel({ weightKg: 0, reps: null, durationSeconds: seconds })
}

// Un record (GYM-010), nell'unità scelta (SET-010): "1RM stimato · 82 kg",
// "Più ripetizioni a 80 kg · 8".
export function recordLabel(
  r: { kind: string; value: number; weightKg: number | null },
  fmt: FormatTools = KG,
) {
  const lifted = (kg: number) => `${mass(kg, fmt)} ${fmt.weightUnit}`
  switch (r.kind) {
    case 'e1rm':
      return `1RM stimato · ${massTotal(r.value, fmt)}`
    case 'weight':
      return `Peso più alto · ${lifted(r.value)}`
    case 'volume':
      return `Volume in una sessione · ${massTotal(r.value, fmt)}`
    case 'reps':
      return `Più ripetizioni a ${lifted(r.weightKg ?? 0)} · ${r.value}`
    default:
      return `Durata più lunga · ${clock(r.value)}`
  }
}

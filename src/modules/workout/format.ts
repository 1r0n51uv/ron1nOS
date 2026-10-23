// Testi del modulo Allenamento.

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

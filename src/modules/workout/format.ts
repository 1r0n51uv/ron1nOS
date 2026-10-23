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

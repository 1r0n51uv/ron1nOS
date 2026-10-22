// Giorni del diario: date locali Europe/Rome `YYYY-MM-DD`, come nel backend.
const TIME_ZONE = 'Europe/Rome'

export function todayRome(now = new Date()) {
  return now.toLocaleDateString('sv-SE', { timeZone: TIME_ZONE })
}

export function addDays(day: string, n: number) {
  const d = new Date(`${day}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function isDay(value: string | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`))
}

const at = (day: string) => new Date(`${day}T12:00:00Z`)

// "mer" e "21" per la striscia dei giorni.
export function weekdayShort(day: string) {
  return at(day).toLocaleDateString('it-IT', { weekday: 'short', timeZone: 'UTC' }).replace('.', '')
}

export function dayOfMonth(day: string) {
  return String(at(day).getUTCDate())
}

// "MERCOLEDÌ 21 OTTOBRE", come l'occhiello della dashboard.
export function eyebrowDay(day: string) {
  return at(day)
    .toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
    .toUpperCase()
}

// La striscia di pkm (ADR-0036): 10 giorni indietro, oggi, 13 avanti.
export function stripDays(today: string) {
  return Array.from({ length: 24 }, (_, i) => addDays(today, i - 10))
}

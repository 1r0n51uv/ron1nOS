// I giorni del modulo sono date locali Europe/Rome, `YYYY-MM-DD`
// (specifica Nutrizione, Endpoint).
export const TIME_ZONE = 'Europe/Rome'

const DAY = /^\d{4}-\d{2}-\d{2}$/

export function isDay(value: unknown): value is string {
  if (typeof value !== 'string' || !DAY.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

export function today(now = new Date()) {
  return now.toLocaleDateString('sv-SE', { timeZone: TIME_ZONE })
}

// Ora locale (0–23) a Roma, per lo slot proposto e lo spuntino di YAZIO.
export function localHour(now = new Date()) {
  return Number(now.toLocaleString('en-GB', { timeZone: TIME_ZONE, hour: '2-digit', hourCycle: 'h23' }))
}

export function addDays(day: string, n: number) {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// 1 = lunedì … 7 = domenica.
export function weekday(day: string) {
  const w = new Date(`${day}T00:00:00Z`).getUTCDay()
  return w === 0 ? 7 : w
}

export function mondayOf(day: string) {
  return addDays(day, 1 - weekday(day))
}

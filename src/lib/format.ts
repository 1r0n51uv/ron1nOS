// Formattazione italiana: virgola decimale, punto delle migliaia.
const it = 'it-IT'

export function num(value: number, digits = 0) {
  return value.toLocaleString(it, { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

// Il segno meno tipografico (−) al posto del trattino, come nei mockup.
export function signed(value: number, digits = 1) {
  const s = num(Math.abs(value), digits)
  return value < 0 ? `−${s}` : `+${s}`
}

export function clock(totalSeconds: number) {
  const s = Math.max(0, Math.round(totalSeconds))
  const mm = String(Math.floor(s / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

export function eyebrowDate(d: Date) {
  return d.toLocaleDateString(it, { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()
}

export function time(d: Date) {
  return d.toLocaleTimeString(it, { hour: '2-digit', minute: '2-digit' })
}

export function greeting(d: Date) {
  const h = d.getHours()
  if (h < 5) return 'Buonanotte.'
  if (h < 13) return 'Buongiorno.'
  if (h < 18) return 'Buon pomeriggio.'
  return 'Buonasera.'
}

// Da quanto è acceso un sistema: ore sotto il giorno, poi giorni.
export function uptime(totalSeconds: number) {
  const hours = Math.floor(Math.max(0, totalSeconds) / 3_600)
  return hours < 24 ? `${hours} h` : `${Math.floor(hours / 24)} g`
}

// Velocità di trasferimento in unità decimali: kB/s sotto 1 MB/s, poi MB/s.
export function rate(bytesPerSecond: number) {
  const b = Math.max(0, bytesPerSecond)
  return b < 1_000_000 ? `${num(b / 1_000)} kB/s` : `${num(b / 1_000_000, 1)} MB/s`
}

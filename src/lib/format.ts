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

// Versione corta per la testata su una riga: "GIO 22 OTT".
export function eyebrowShortDate(d: Date) {
  return d
    .toLocaleDateString(it, { weekday: 'short', day: 'numeric', month: 'short' })
    .replaceAll('.', '')
    .toUpperCase()
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

// Memoria in unità decimali: MB interi sotto 1 GB, poi GB con un decimale.
export function bytes(value: number) {
  const b = Math.max(0, value)
  return b < 1_000_000_000 ? `${num(b / 1_000_000)} MB` : `${num(b / 1_000_000_000, 1)} GB`
}

// Dimensioni in unità decimali, come qBittorrent: 1 KB, 3,9 GB, 412 GB.
export function fileSize(value: number) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let v = Math.max(0, value)
  let i = 0
  while (v >= 1000 && i < units.length - 1) {
    v /= 1000
    i++
  }
  // Una cifra decimale solo sotto 10 e oltre i KB.
  const digits = i >= 2 && v < 10 ? 1 : 0
  return `${num(v, digits)} ${units[i]}`
}

// Un giorno `YYYY-MM-DD` come "22 ott", senza passare dal fuso del browser.
export function shortDay(day: string) {
  return new Date(`${day}T12:00:00Z`)
    .toLocaleDateString(it, { day: 'numeric', month: 'short', timeZone: 'UTC' })
    .replace('.', '')
}

// Parser dell'export CSV di Liftin' (GYM-003), portato da LiftinCSV di
// 1r0-pkm. Header atteso, separatore `;`:
//
//   Date;Duration;Routine;Exercise;Set;Warmup;Weight;Reps/Time;Goal;Perception
//
// Le colonne si cercano per nome, non per posizione. `Reps/Time` è doppio:
// intero = ripetizioni, `mm:ss` = durata. Il formato di `Date` e `Duration`
// non è documentato: si prova una lista di formati comuni.
import { TIME_ZONE } from '../nutrition/dates.ts'
import { InvalidRequestError } from '../nutrition/http.ts'

export type LiftinRow = {
  // Giorno locale a Roma, `YYYY-MM-DD`.
  day: string
  startedAt: Date
  routine: string
  workoutDurationSeconds: number | null
  exercise: string
  setIndex: number
  isWarmup: boolean
  weightKg: number
  reps: number | null
  setDurationSeconds: number | null
  perception: number | null
}

export type LiftinParse = { rows: LiftinRow[]; skipped: number }

// 400 invalid_request con un messaggio da mostrare nel dialog.
export class LiftinError extends InvalidRequestError {}

export function parseLiftin(text: string): LiftinParse {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r\n|\r|\n/)
    .map((l) => l.trim())
    .filter((l) => l !== '')
  const headerLine = lines[0]
  if (headerLine === undefined) throw new LiftinError('Il file è vuoto')

  const header = splitRow(headerLine).map(normalizeKey)
  const col = (...names: string[]) => {
    for (const n of names) {
      const i = header.indexOf(normalizeKey(n))
      if (i >= 0) return i
    }
    return null
  }
  const iDate = col('date')
  const iExercise = col('exercise')
  const iSet = col('set')
  if (iDate === null || iExercise === null || iSet === null) {
    const missing = [iDate === null && 'Date', iExercise === null && 'Exercise', iSet === null && 'Set']
    throw new LiftinError(`Colonne mancanti: ${missing.filter(Boolean).join(', ')}`)
  }
  const iDuration = col('duration')
  const iRoutine = col('routine')
  const iWarmup = col('warmup')
  const iWeight = col('weight')
  const iRepsTime = col('reps/time', 'repstime', 'reps', 'reps time')
  const iPerception = col('perception', 'rpe')

  const rows: LiftinRow[] = []
  let skipped = 0
  for (const line of lines.slice(1)) {
    const f = splitRow(line)
    const field = (i: number | null) => (i === null ? '' : (f[i] ?? ''))

    const date = parseDate(field(iDate))
    const exercise = field(iExercise).replace(/\s+/g, ' ').trim()
    if (!date || exercise === '') {
      skipped += 1
      continue
    }
    const setIndex = /^\d+$/.test(field(iSet)) ? Math.max(1, Number(field(iSet))) : 1
    const { reps, seconds } = parseRepsOrTime(field(iRepsTime))
    rows.push({
      day: date.day,
      startedAt: date.at,
      routine: field(iRoutine),
      workoutDurationSeconds: parseDuration(field(iDuration)),
      exercise,
      setIndex,
      isWarmup: parseBool(field(iWarmup)),
      weightKg: Math.max(0, parseDecimal(field(iWeight)) ?? 0),
      reps,
      setDurationSeconds: seconds,
      perception: parseDecimal(field(iPerception)),
    })
  }
  if (rows.length === 0) throw new LiftinError('Nessuna riga valida nel CSV')
  return { rows, skipped }
}

// Niente `;` dentro i campi negli export di Liftin': split semplice, più le
// virgolette di contorno tolte.
function splitRow(line: string) {
  return line.split(';').map((raw) => {
    const s = raw.trim()
    return s.length >= 2 && s.startsWith('"') && s.endsWith('"') ? s.slice(1, -1).trim() : s
  })
}

function normalizeKey(s: string) {
  return s.trim().toLowerCase()
}

function parseBool(s: string) {
  return ['1', 'true', 'yes', 'y', 'si', 'sì', 'x', 'warmup'].includes(s.toLowerCase())
}

function parseDecimal(s: string) {
  const t = s.trim().replace(',', '.')
  if (!/^-?\d+(\.\d+)?$|^-?\.\d+$/.test(t)) return null
  return Number(t)
}

// Intero = ripetizioni; con `:` è una durata `mm:ss` o `hh:mm:ss`.
function parseRepsOrTime(s: string): { reps: number | null; seconds: number | null } {
  const t = s.trim()
  if (t === '') return { reps: null, seconds: null }
  if (t.includes(':')) return { reps: null, seconds: parseClock(t) }
  const n = parseDecimal(t)
  return { reps: n === null || n < 0 ? null : Math.round(n), seconds: null }
}

// `ss`, `mm:ss` o `hh:mm:ss` in secondi.
function parseClock(s: string) {
  const parts = s.split(':').map((p) => p.trim())
  if (!parts.every((p) => /^\d+$/.test(p))) return null
  const n = parts.map(Number)
  if (n.length === 1) return n[0]!
  if (n.length === 2) return n[0]! * 60 + n[1]!
  if (n.length === 3) return n[0]! * 3600 + n[1]! * 60 + n[2]!
  return null
}

// `Duration` dell'allenamento: secondi interi, `mm:ss` / `hh:mm:ss`, oppure
// `1h 23m`, `45 min`.
function parseDuration(s: string) {
  const t = s.trim().toLowerCase()
  if (t === '') return null
  if (t.includes(':')) return parseClock(t)
  if (/^\d+$/.test(t)) return Number(t)
  let total = 0
  let matched = false
  for (const [unit, factor] of [
    ['h', 3600],
    ['m', 60],
    ['s', 1],
  ] as const) {
    const m = new RegExp(`(\\d+)\\s*${unit}`).exec(t)
    if (m) {
      total += Number(m[1]) * factor
      matched = true
    }
  }
  return matched ? total : null
}

type Parts = { y: number; mo: number; d: number; h: number; mi: number; s: number }

const DATE_FORMATS: { re: RegExp; parts: (m: RegExpExecArray) => Parts }[] = [
  // yyyy-MM-dd, con ora facoltativa (spazio o T) e secondi facoltativi.
  {
    re: /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/,
    parts: (m) => ({ y: +m[1]!, mo: +m[2]!, d: +m[3]!, h: +(m[4] ?? 0), mi: +(m[5] ?? 0), s: +(m[6] ?? 0) }),
  },
  // dd/MM/yyyy [HH:mm], come in Italia; se il giorno non può essere un
  // giorno si prova MM/dd/yyyy.
  {
    re: /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?: (\d{1,2}):(\d{2}))?$/,
    parts: (m) => {
      const a = +m[1]!
      const b = +m[2]!
      const [d, mo] = b > 12 ? [b, a] : [a, b]
      return { y: +m[3]!, mo, d, h: +(m[4] ?? 0), mi: +(m[5] ?? 0), s: 0 }
    },
  },
  // dd.MM.yyyy e dd-MM-yyyy.
  {
    re: /^(\d{1,2})[.-](\d{1,2})[.-](\d{4})$/,
    parts: (m) => ({ y: +m[3]!, mo: +m[2]!, d: +m[1]!, h: 0, mi: 0, s: 0 }),
  },
]

function parseDate(s: string): { day: string; at: Date } | null {
  const t = s.trim()
  if (t === '') return null
  // Con il fuso (Z o ±hh:mm) l'istante è certo; il giorno è quello di Roma.
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/.test(t)) {
    const at = new Date(t)
    if (Number.isNaN(at.getTime())) return null
    return { day: at.toLocaleDateString('sv-SE', { timeZone: TIME_ZONE }), at }
  }
  for (const f of DATE_FORMATS) {
    const m = f.re.exec(t)
    if (!m) continue
    const p = f.parts(m)
    if (!validParts(p)) return null
    const day = `${p.y}-${pad(p.mo)}-${pad(p.d)}`
    return { day, at: romeInstant(p) }
  }
  return null
}

function validParts(p: Parts) {
  if (p.mo < 1 || p.mo > 12 || p.d < 1 || p.h > 23 || p.mi > 59 || p.s > 59) return false
  const probe = new Date(Date.UTC(p.y, p.mo - 1, p.d))
  return probe.getUTCDate() === p.d && probe.getUTCMonth() === p.mo - 1
}

const pad = (n: number) => String(n).padStart(2, '0')

// L'istante di un'ora scritta senza fuso, letta come ora di Roma: si parte
// da UTC e si corregge con lo scarto di Roma in quel momento.
function romeInstant(p: Parts) {
  const asUtc = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s)
  const offset = romeOffset(new Date(asUtc))
  const guess = asUtc - offset
  return new Date(asUtc - romeOffset(new Date(guess)))
}

function romeOffset(at: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at)
  const get = (type: string) => Number(parts.find((x) => x.type === type)?.value)
  const local = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return local - Math.floor(at.getTime() / 1000) * 1000
}

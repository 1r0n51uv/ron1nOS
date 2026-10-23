// Catalogo delle immagini degli esercizi (GYM-014): free-exercise-db
// (github.com/yuhonas/free-exercise-db, Unlicense), 876 esercizi con due
// foto ciascuno. Il backend ne tiene una copia nella cartella del volume:
// l'elenco si scarica al primo avvio, ogni foto alla prima richiesta, e da
// lì si serve dal disco. Le pagine non caricano mai immagini da GitHub.
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { normalizeExercise } from './math.ts'

// Una versione fissa del catalogo: per aggiornarlo si cambia il commit (o
// WORKOUT_CATALOG_URL) e al riavvio l'elenco si riscarica.
export const DEFAULT_CATALOG_URL =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5'

export type CatalogEntry = {
  id: string
  name: string
  primaryMuscles: string[]
  equipment: string | null
  // Numero di foto: si servono come /catalog/images/{id}/{n}.jpg.
  images: number
}

export type Catalog = {
  // Carica l'elenco dal disco o lo scarica; senza, le rotte rispondono 503.
  ready(): Promise<boolean>
  get(id: string): CatalogEntry | undefined
  search(q: string, limit?: number): CatalogEntry[]
  // L'esercizio con lo stesso nome inglese, a meno di maiuscole e spazi.
  byName(exerciseKey: string): CatalogEntry | undefined
  // La foto n di un esercizio, dal disco o scaricata e salvata.
  image(id: string, n: number): Promise<Buffer | null>
}

const RETRY_MS = 60_000

export class CatalogUnavailableError extends Error {}

type Raw = {
  id?: unknown
  name?: unknown
  primaryMuscles?: unknown
  equipment?: unknown
  images?: unknown
}

// Gli id diventano nomi di cartella: niente barre né `..`.
const ID = /^(?!.*\.\.)[A-Za-z0-9_.()'-]+$/

export function toEntries(raw: unknown): CatalogEntry[] {
  if (!Array.isArray(raw)) return []
  return (raw as Raw[]).flatMap((e) => {
    if (typeof e.id !== 'string' || !ID.test(e.id) || typeof e.name !== 'string') return []
    const images = Array.isArray(e.images) ? e.images.length : 0
    if (images === 0) return []
    return [
      {
        id: e.id,
        name: e.name,
        primaryMuscles: Array.isArray(e.primaryMuscles)
          ? e.primaryMuscles.filter((m): m is string => typeof m === 'string')
          : [],
        equipment: typeof e.equipment === 'string' ? e.equipment : null,
        images,
      },
    ]
  })
}

const words = (s: string) =>
  s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)

export function createCatalog({
  dir,
  url = DEFAULT_CATALOG_URL,
  fetchImpl = fetch,
  now = Date.now,
}: {
  dir: string
  url?: string
  fetchImpl?: typeof fetch
  now?: () => number
}): Catalog {
  const base = url.replace(/\/+$/, '')
  let entries: Map<string, CatalogEntry> | null = null
  let names = new Map<string, CatalogEntry>()
  let loading: Promise<boolean> | null = null
  // Dopo un download fallito si riprova al più una volta al minuto.
  let failedAt = -Infinity

  async function write(path: string, data: string | Buffer) {
    // Prima un file temporaneo, poi il nome vero: niente file a metà.
    const tmp = `${path}.${process.pid}.tmp`
    await writeFile(tmp, data)
    await rename(tmp, path)
  }

  async function load() {
    const listPath = join(dir, 'exercises.json')
    const metaPath = join(dir, 'source.json')
    const source = await readFile(metaPath, 'utf8')
      .then((t) => (JSON.parse(t) as { url?: string }).url)
      .catch(() => undefined)
    let raw: unknown
    if (source === base) raw = await readFile(listPath, 'utf8').then(JSON.parse, () => undefined)
    if (raw === undefined) {
      const res = await fetchImpl(`${base}/dist/exercises.json`)
      if (!res.ok) throw new CatalogUnavailableError(`elenco: HTTP ${res.status}`)
      const text = await res.text()
      raw = JSON.parse(text)
      await mkdir(dir, { recursive: true })
      await write(listPath, text)
      await write(metaPath, JSON.stringify({ url: base, fetchedAt: new Date().toISOString() }))
    }
    const list = toEntries(raw)
    if (list.length === 0) throw new CatalogUnavailableError('elenco vuoto')
    entries = new Map(list.map((e) => [e.id, e]))
    names = new Map(list.map((e) => [normalizeExercise(e.name), e]))
  }

  return {
    async ready() {
      if (entries) return true
      if (!loading && now() - failedAt < RETRY_MS) return false
      loading ??= load()
        .then(() => true)
        .catch((err: Error) => {
          failedAt = now()
          console.warn(`catalogo esercizi non disponibile: ${err.message}`)
          return false
        })
        .finally(() => {
          loading = null
        })
      return loading
    },
    get: (id) => entries?.get(id),
    byName: (exerciseKey) => names.get(exerciseKey),
    search(q, limit = 60) {
      const list = [...(entries?.values() ?? [])]
      const terms = words(q)
      const hits = terms.length
        ? list.filter((e) => {
            const name = words(e.name)
            return terms.every((t) => name.some((w) => w.startsWith(t)))
          })
        : list
      return hits.sort((a, b) => a.name.localeCompare(b.name)).slice(0, limit)
    },
    async image(id, n) {
      const entry = entries?.get(id)
      if (!entry || !Number.isInteger(n) || n < 0 || n >= entry.images) return null
      const folder = join(dir, 'images', id)
      const path = join(folder, `${n}.jpg`)
      const cached = await readFile(path).catch(() => null)
      if (cached) return cached
      const res = await fetchImpl(`${base}/exercises/${encodeURIComponent(id)}/${n}.jpg`)
      if (!res.ok) throw new CatalogUnavailableError(`foto ${id}/${n}: HTTP ${res.status}`)
      const data = Buffer.from(await res.arrayBuffer())
      await mkdir(folder, { recursive: true })
      await write(path, data)
      return data
    },
  }
}

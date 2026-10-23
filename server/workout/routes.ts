// Rotte del modulo Allenamento sotto /api/v1/workout (specifica
// docs/specs/workout.md, contratto in api/openapi.yaml).
import { Hono } from 'hono'
import type { Context } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { z } from 'zod'

import type { Database, Db } from '../db.ts'
import { DatabaseUnavailableError } from '../db.ts'
import { check, InvalidRequestError, NotFoundError, readJson } from '../nutrition/http.ts'
import type { Catalog } from './catalog.ts'
import { CatalogUnavailableError } from './catalog.ts'
import { exerciseImages, imageUrl, setExerciseImage } from './images.ts'
import { importLiftin } from './import.ts'
import { LiftinError, parseLiftin } from './liftin.ts'
import { normalizeExercise } from './math.ts'
import { deleteSession, getSession } from './detail.ts'
import { getExercise, RANGES } from './exercise.ts'
import type { ExerciseRange } from './exercise.ts'
import { listExercises } from './exercises.ts'
import {
  exerciseGroup,
  groupFromMuscles,
  MUSCLE_GROUPS,
  proposeExerciseGroup,
  setExerciseGroup,
} from './groups.ts'
import { DEFAULT_WEEKS, groupVolume } from './muscles.ts'
import { recentRecords } from './records.ts'
import { decodeCursor, listRoutines, listSessions } from './sessions.ts'
import { getSummary } from './summary.ts'

type WorkoutDeps = {
  database: Database
  now?: () => Date
  // Catalogo delle immagini (GYM-014); senza, le sue rotte rispondono 503.
  catalog?: Catalog
}

const ImageInput = z.object({ catalogId: z.string().min(1).max(200).nullable() })
const GroupInput = z.object({ group: z.enum(MUSCLE_GROUPS).nullable() })
const SessionId = z.uuid()
const ExerciseName = z.string().trim().min(1).max(200)
const Range = z.enum(Object.keys(RANGES) as [ExerciseRange, ...ExerciseRange[]]).default('6m')
const RecordsQuery = z.object({
  days: z.coerce.number().int().min(1).max(3650).default(30),
  limit: z.coerce.number().int().min(1).max(50).default(3),
})
const WeeksQuery = z.object({ weeks: z.coerce.number().int().min(1).max(52).default(DEFAULT_WEEKS) })
const ExercisesQuery = z.object({
  q: z.string().max(100).optional(),
  sort: z.enum(['recent', 'sets']).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  incomplete: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
})

// Il CSV completo di Liftin' resta sotto i 5 MB anche dopo anni.
export const MAX_CSV_BYTES = 5 * 1024 * 1024

const csvLimit = bodyLimit({
  maxSize: MAX_CSV_BYTES + 64 * 1024,
  onError: () => {
    throw new LiftinError('Il file supera i 5 MB')
  },
})

// Il file arriva come multipart, campo `file`; il client non lo interpreta.
async function readCsv(c: Context) {
  const type = c.req.header('content-type') ?? ''
  if (!type.startsWith('multipart/form-data')) throw new InvalidRequestError('Carica un file CSV')
  const body = await c.req.parseBody().catch(() => {
    throw new InvalidRequestError('Carica un file CSV')
  })
  const file = body.file
  if (!(file instanceof File)) throw new InvalidRequestError('Carica un file CSV')
  if (file.size > MAX_CSV_BYTES) throw new LiftinError('Il file supera i 5 MB')
  return parseLiftin(await file.text())
}

export function workoutRoutes({ database, catalog, now = () => new Date() }: WorkoutDeps) {
  const app = new Hono<{ Variables: { db: Db } }>()

  async function readyCatalog() {
    if (!catalog || !(await catalog.ready())) throw new CatalogUnavailableError('catalogo non pronto')
    return catalog
  }

  // Le rotte del catalogo vengono prima del controllo del database: le foto
  // si servono anche con Postgres fermo.

  // Ricerca nel catalogo per il dialog Scegli immagine (GYM-014), nomi in inglese.
  app.get('/catalog', async (c) => {
    const ready = await readyCatalog()
    const q = (c.req.query('q') ?? '').slice(0, 100)
    return c.json({ exercises: ready.search(q).map((e) => ({ ...e, url: imageUrl(e.id) })) })
  })

  // La foto, dalla copia nel volume. Non cambia mai per lo stesso id.
  app.get('/catalog/images/:id/:file', async (c) => {
    const ready = await readyCatalog()
    const n = /^(\d)\.jpg$/.exec(c.req.param('file'))?.[1]
    const image = n === undefined ? null : await ready.image(c.req.param('id'), Number(n))
    if (!image) throw new NotFoundError('Immagine non trovata')
    return c.body(new Uint8Array(image), 200, {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'private, max-age=31536000, immutable',
    })
  })

  // Senza Postgres il modulo risponde 503; il resto della dashboard no.
  app.use('*', async (c, next) => {
    if (database.status() !== 'ok' || !database.db) throw new DatabaseUnavailableError('database non pronto')
    c.set('db', database.db)
    await next()
  })

  // Ultimo allenamento, settimana e giorni di fila (GYM-001, GYM-013).
  app.get('/summary', async (c) => c.json(await getSummary(c.get('db'), catalog, now())))

  // Storico a pagine da 20, dalla più recente (GYM-004).
  app.get('/sessions', async (c) => {
    const routine = c.req.query('routine')
    const cursor = c.req.query('cursor')
    const after = cursor ? decodeCursor(cursor) : undefined
    if (after === null) throw new InvalidRequestError('Cursore non valido')
    return c.json(await listSessions(c.get('db'), catalog, { routine: routine || undefined, after }))
  })

  // Dettaglio di una sessione (GYM-005).
  app.get('/sessions/:id', async (c) =>
    c.json(await getSession(c.get('db'), catalog, check(SessionId, c.req.param('id')))),
  )

  // Elimina una sessione (GYM-006): un re-import non la riporta.
  app.delete('/sessions/:id', async (c) => {
    const id = check(SessionId, c.req.param('id'))
    await c.get('db').tx((tx) => deleteSession(tx, id))
    return c.body(null, 204)
  })

  // Nomi delle routine per il filtro dello storico (GYM-004).
  app.get('/routines', async (c) => c.json({ routines: await listRoutines(c.get('db')) }))

  // Esercizi (GYM-007, GYM-009): `sort=sets&limit=6` dà la dashboard,
  // senza parametri l'elenco dall'ultima volta più recente,
  // `incomplete=true` quelli senza gruppo o senza immagine.
  app.get('/exercises', async (c) => {
    const query = check(ExercisesQuery, c.req.query())
    return c.json({ exercises: await listExercises(c.get('db'), catalog, query) })
  })

  // Un esercizio (GYM-008): testata, grafici nel periodo e ultime 3 volte.
  app.get('/exercises/:name', async (c) => {
    const key = normalizeExercise(check(ExerciseName, c.req.param('name')))
    const range = check(Range, c.req.query('range'))
    return c.json(await getExercise(c.get('db'), catalog, key, range, now()))
  })

  // Record battuti negli ultimi giorni (GYM-010), dal più recente.
  app.get('/records', async (c) => {
    const { days, limit } = check(RecordsQuery, c.req.query())
    return c.json({ records: await recentRecords(c.get('db'), catalog, { days, limit, now: now() }) })
  })

  // Volume e serie per gruppo muscolare, settimana per settimana (GYM-012).
  app.get('/muscle-groups', async (c) => {
    const { weeks } = check(WeeksQuery, c.req.query())
    return c.json(await groupVolume(c.get('db'), { weeks, now: now() }))
  })

  // Anteprima dell'import (GYM-003): stessi conti dell'import, nessuna scrittura.
  app.post('/import/preview', csvLimit, async (c) => {
    const parsed = await readCsv(c)
    return c.json(await importLiftin(c.get('db'), parsed, { apply: false }))
  })

  app.post('/import', csvLimit, async (c) => {
    const parsed = await readCsv(c)
    const summary = await c.get('db').tx(async (tx) => {
      // Due import insieme non devono creare la stessa sessione due volte.
      await tx.query('select pg_advisory_xact_lock(7210010)')
      return importLiftin(tx, parsed, { apply: true })
    })
    return c.json(summary)
  })

  // L'immagine scelta a mano per un esercizio (GYM-014); null torna
  // all'abbinamento automatico. Vale per tutte le sessioni con quel nome.
  app.put('/exercises/:name/image', async (c) => {
    const key = normalizeExercise(check(ExerciseName, c.req.param('name')))
    const { catalogId } = await readJson(c, ImageInput)
    const entry = catalogId === null ? undefined : (await readyCatalog()).get(catalogId)
    if (catalogId !== null && !entry) throw new NotFoundError('Immagine non trovata nel catalogo')
    const db = c.get('db')
    await db.tx(async (tx) => {
      await setExerciseImage(tx, key, catalogId)
      // Senza gruppo, si propone quello dei muscoli principali (GYM-011).
      await proposeExerciseGroup(tx, key, entry ? groupFromMuscles(entry.primaryMuscles) : null)
    })
    const images = await exerciseImages(db, catalog, [key])
    return c.json({ name: key, image: images.get(key) ?? null, group: await exerciseGroup(db, key) })
  })

  // Il gruppo muscolare di un esercizio (GYM-011); null lo toglie.
  app.put('/exercises/:name/group', async (c) => {
    const key = normalizeExercise(check(ExerciseName, c.req.param('name')))
    const { group } = await readJson(c, GroupInput)
    await setExerciseGroup(c.get('db'), key, group)
    return c.json({ name: key, group })
  })

  return app
}

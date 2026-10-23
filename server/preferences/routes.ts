// Rotte delle preferenze sotto /api/v1/preferences (docs/specs/settings.md).
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'

import type { Database, Db } from '../db.ts'
import { DatabaseUnavailableError } from '../db.ts'
import { check, InvalidRequestError, NotFoundError, readJson } from '../nutrition/http.ts'
import {
  BackgroundTooLargeError,
  backgroundType,
  deleteBackground,
  getBackground,
  hasBackground,
  MAX_BACKGROUND_BYTES,
  putBackground,
} from './background.ts'
import { applyPatch, DEFAULT_PREFERENCES, Preferences, PreferencesPatch } from './schema.ts'
import { getPreferences, patchPreferences } from './store.ts'

const IMAGE_REQUIRED = 'Serve un’immagine JPEG, PNG o WebP'

export function preferencesRoutes({ database }: { database: Database }) {
  const app = new Hono()

  function ready(): Db {
    if (database.status() !== 'ok' || !database.db) throw new DatabaseUnavailableError('database non pronto')
    return database.db
  }

  // Le preferenze con la data dell'immagine di sfondo, se c'è: il client la
  // usa per non tenere in cache quella vecchia.
  async function respond(db: Db, prefs: Awaited<ReturnType<typeof getPreferences>>) {
    const image = await getBackground(db)
    return { ...prefs, backgroundImage: image ? image.updatedAt.toISOString() : null, stored: true }
  }

  // Senza database valgono i predefiniti: `stored: false` dice al client di avvisare.
  app.get('/', async (c) => {
    if (database.status() !== 'ok' || !database.db) {
      return c.json({ ...DEFAULT_PREFERENCES, updatedAt: null, backgroundImage: null, stored: false })
    }
    const db = database.db
    return c.json(await respond(db, await getPreferences(db)))
  })

  app.patch('/', async (c) => {
    const patch = await readJson(c, PreferencesPatch)
    // La forma si controlla anche senza database, come per il layout.
    check(Preferences, applyPatch(DEFAULT_PREFERENCES, patch))
    const db = ready()
    if (patch.appearance?.background === 'image' && !(await hasBackground(db))) {
      throw new InvalidRequestError('Carica prima un’immagine di sfondo')
    }
    return c.json(await respond(db, await patchPreferences(db, patch)))
  })

  // Sfondo caricato (SET-003): multipart, campo `file`. Salvarlo lo mette
  // anche in uso.
  app.put(
    '/background',
    bodyLimit({
      maxSize: MAX_BACKGROUND_BYTES + 64 * 1024,
      onError: () => {
        throw new BackgroundTooLargeError()
      },
    }),
    async (c) => {
      const db = ready()
      if (!(c.req.header('content-type') ?? '').startsWith('multipart/form-data')) {
        throw new InvalidRequestError(IMAGE_REQUIRED)
      }
      const form = await c.req.parseBody().catch(() => {
        throw new InvalidRequestError(IMAGE_REQUIRED)
      })
      const file = form.file
      if (!(file instanceof File)) throw new InvalidRequestError(IMAGE_REQUIRED)
      if (file.size > MAX_BACKGROUND_BYTES) throw new BackgroundTooLargeError()
      const content = Buffer.from(await file.arrayBuffer())
      const mime = backgroundType(content)
      if (!mime) throw new InvalidRequestError(IMAGE_REQUIRED)
      await putBackground(db, mime, content)
      return c.json(await respond(db, await patchPreferences(db, { appearance: { background: 'image' } })))
    },
  )

  app.get('/background', async (c) => {
    const image = await getBackground(ready())
    if (!image) throw new NotFoundError('Nessuna immagine di sfondo')
    return c.body(new Uint8Array(image.content), 200, {
      'Content-Type': image.mime,
      'Cache-Control': 'private, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    })
  })

  // Toglie l'immagine; se era in uso torna lo sfondo predefinito.
  app.delete('/background', async (c) => {
    const db = ready()
    await deleteBackground(db)
    const prefs = await getPreferences(db)
    const next =
      prefs.appearance.background === 'image'
        ? await patchPreferences(db, {
            appearance: { background: DEFAULT_PREFERENCES.appearance.background },
          })
        : prefs
    return c.json(await respond(db, next))
  })

  return app
}

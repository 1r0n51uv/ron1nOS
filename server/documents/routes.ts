// Rotte del modulo Documenti sotto /api/v1/documents (specifica
// docs/specs/documents.md, contratto in api/openapi.yaml). Il modulo parte
// solo con il login acceso e DOCUMENTS_KEY: senza, risponde 503.
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { z } from 'zod'

import type { Database, Db, Queryable } from '../db.ts'
import { DatabaseUnavailableError } from '../db.ts'
import { isDay } from '../nutrition/dates.ts'
import { check, InvalidRequestError, NotFoundError, readJson } from '../nutrition/http.ts'
import type { Vault } from './crypto.ts'
import type { FileLabel } from './files.ts'
import {
  deleteFile,
  getFile,
  insertFile,
  LABELS,
  listFiles,
  MAX_FILE_BYTES,
  readContent,
  updateFile,
} from './files.ts'
import { expiryOf, WARNINGS } from './status.ts'
import type { DocumentInput, StoredDocument } from './store.ts'
import {
  deleteDocument,
  insertDocument,
  listDocuments,
  listHolders,
  readDocument,
  updateDocument,
} from './store.ts'
import type { DocumentType } from './types.ts'
import { checkFields, getType, listTypes, retype } from './types.ts'

export type DocumentsDeps = {
  database: Database
  // undefined = DOCUMENTS_KEY mancante o non valida.
  vault?: Vault
  // Il modulo non parte senza login (docs/specs/auth.md).
  authEnabled: boolean
  now?: () => Date
}

export class DocumentsDisabledError extends Error {}
// 413 file_too_large: oltre i 20 MB (DOC-011).
export class FileTooLargeError extends Error {}

// Titolare di default (DOC-007): il proprietario della dashboard.
export const DEFAULT_HOLDER = 'Io'
const MAX_EXTRA = 30

const Id = z.uuid()
const Title = z.string().trim().min(1).max(120)
const Holder = z.string().trim().min(1).max(60)
const ExpiresOn = z.string().refine(isDay, 'data non valida').nullable()
const Warnings = z.array(z.literal([...WARNINGS])).transform((ws) => [...new Set(ws)].sort((a, b) => b - a))
const Tags = z
  .array(z.string().trim().min(1).max(40))
  .max(20)
  .transform((ts) => [...new Set(ts)])
const Extra = z.array(
  z.object({ label: z.string().trim().min(1).max(60), value: z.string().trim().min(1).max(2000) }),
)
const Notes = z.string().max(5000)
const Fields = z.record(z.string(), z.string())

const CreateBody = z.object({
  typeId: Id.nullable().default(null),
  title: Title,
  holder: Holder.default(DEFAULT_HOLDER),
  expiresOn: ExpiresOn.default(null),
  warnings: Warnings.default([...WARNINGS]),
  tags: Tags.default([]),
  pinned: z.boolean().default(false),
  fields: Fields.default({}),
  extra: Extra.default([]),
  notes: Notes.default(''),
})

const PatchBody = z.object({
  typeId: Id.nullable().optional(),
  title: Title.optional(),
  holder: Holder.optional(),
  expiresOn: ExpiresOn.optional(),
  warnings: Warnings.optional(),
  tags: Tags.optional(),
  pinned: z.boolean().optional(),
  fields: Fields.optional(),
  extra: Extra.optional(),
  notes: Notes.optional(),
})

const Label = z.enum(LABELS)
const FilePatch = z.object({ label: Label.optional(), position: z.int().min(0).optional() })

const ListQuery = z.object({
  q: z.string().trim().max(100).optional(),
  type: z.union([Id, z.literal('none')]).optional(),
  holder: z.string().trim().max(60).optional(),
})

export function documentsRoutes({ database, vault, authEnabled, now = () => new Date() }: DocumentsDeps) {
  const routes = new Hono()

  const ready = (): { db: Db; vault: Vault } => {
    if (!authEnabled || !vault) {
      throw new DocumentsDisabledError(
        !authEnabled ? 'Il modulo Documenti richiede il login' : 'DOCUMENTS_KEY mancante o non valida',
      )
    }
    if (!database.db || database.status() !== 'ok') throw new DatabaseUnavailableError('database non pronto')
    return { db: database.db, vault }
  }

  // Niente copie dei documenti nella cache del browser (DOC-012).
  routes.use('*', async (c, next) => {
    await next()
    c.header('Cache-Control', 'no-store')
  })

  const typeOf = async (db: Queryable, typeId: string | null) => {
    if (!typeId) return null
    const type = await getType(db, typeId)
    if (!type) throw new InvalidRequestError('Tipo di documento sconosciuto')
    return type
  }

  const validFields = (type: DocumentType | null, fields: Record<string, string>) => {
    if (!type) {
      if (Object.values(fields).some((v) => v.trim())) {
        throw new InvalidRequestError('Un documento senza tipo ha solo campi liberi')
      }
      return {}
    }
    const result = checkFields(type, fields)
    if (!result.ok) throw new InvalidRequestError(result.message)
    return result.values
  }

  const validExtra = (extra: DocumentInput['extra']) => {
    if (extra.length > MAX_EXTRA) throw new InvalidRequestError(`Al massimo ${MAX_EXTRA} campi liberi`)
    return extra
  }

  const docId = (raw: string) => {
    if (!Id.safeParse(raw).success) throw new NotFoundError('Documento non trovato')
    return raw
  }

  const load = async (db: Queryable, v: Vault, id: string) => {
    const doc = await readDocument(db, v, docId(id))
    if (!doc) throw new NotFoundError('Documento non trovato')
    return doc
  }

  // Il dettaglio (DOC-004): documento, tipo, stato della scadenza e allegati.
  const detail = async (db: Queryable, doc: StoredDocument) => {
    const type = doc.typeId ? await getType(db, doc.typeId) : null
    return {
      ...doc,
      type: type && { id: type.id, name: type.name, icon: type.icon, fields: type.fields },
      expiry: expiryOf(doc.expiresOn, doc.warnings, now()),
      files: await listFiles(db, doc.id),
    }
  }

  routes.get('/types', async (c) => c.json(await listTypes(ready().db)))

  routes.get('/holders', async (c) => c.json(await listHolders(ready().db)))

  routes.get('/documents', async (c) => {
    const { db } = ready()
    const filter = check(ListQuery, c.req.query())
    return c.json(await listDocuments(db, filter, now()))
  })

  routes.post('/documents', async (c) => {
    const { db, vault: v } = ready()
    const body = await readJson(c, CreateBody)
    const type = await typeOf(db, body.typeId)
    const id = await insertDocument(db, v, {
      ...body,
      fields: validFields(type, body.fields),
      extra: validExtra(body.extra),
    })
    return c.json(await detail(db, await load(db, v, id)), 201)
  })

  routes.get('/documents/:id', async (c) => {
    const { db, vault: v } = ready()
    return c.json(await detail(db, await load(db, v, c.req.param('id'))))
  })

  routes.patch('/documents/:id', async (c) => {
    const { db, vault: v } = ready()
    const body = await readJson(c, PatchBody)
    const doc = await load(db, v, c.req.param('id'))
    const typeId = body.typeId === undefined ? doc.typeId : body.typeId
    const type = await typeOf(db, typeId)
    let fields = body.fields ?? doc.fields
    let extra = body.extra ?? doc.extra
    if (typeId !== doc.typeId) {
      // I valori che il nuovo tipo non ha diventano campi liberi.
      const moved = retype(fields, await typeOf(db, doc.typeId).catch(() => null), type)
      fields = moved.fields
      extra = [...extra, ...moved.moved]
    }
    await updateDocument(db, v, doc.id, {
      typeId,
      title: body.title ?? doc.title,
      holder: body.holder ?? doc.holder,
      expiresOn: body.expiresOn === undefined ? doc.expiresOn : body.expiresOn,
      warnings: body.warnings ?? doc.warnings,
      tags: body.tags ?? doc.tags,
      pinned: body.pinned ?? doc.pinnedAt !== null,
      fields: validFields(type, fields),
      extra: validExtra(extra),
      notes: body.notes ?? doc.notes,
    })
    return c.json(await detail(db, await load(db, v, doc.id)))
  })

  routes.delete('/documents/:id', async (c) => {
    const { db } = ready()
    if (!(await deleteDocument(db, docId(c.req.param('id')))))
      throw new NotFoundError('Documento non trovato')
    return c.body(null, 204)
  })

  // Un allegato alla volta (multipart: `file`, `label` facoltativa), così
  // un errore su un file non blocca gli altri (DOC-011).
  routes.post(
    '/documents/:id/files',
    bodyLimit({
      maxSize: MAX_FILE_BYTES + 64 * 1024,
      onError: () => {
        throw new FileTooLargeError()
      },
    }),
    async (c) => {
      const { db, vault: v } = ready()
      const id = docId(c.req.param('id'))
      if (!(c.req.header('content-type') ?? '').startsWith('multipart/form-data')) {
        throw new InvalidRequestError('Serve un file')
      }
      const form = await c.req.parseBody()
      const file = form.file
      if (!(file instanceof File)) throw new InvalidRequestError('Serve un file')
      if (file.size > MAX_FILE_BYTES) throw new FileTooLargeError()
      const label: FileLabel = check(Label.default('altro'), form.label || undefined)
      const content = Buffer.from(await file.arrayBuffer())
      const meta = await db.tx(async (tx) => {
        const { rowCount } = await tx.query('select 1 from documents where id = $1 for update', [id])
        if (!rowCount) throw new NotFoundError('Documento non trovato')
        return insertFile(tx, v, id, { name: file.name, label, content })
      })
      return c.json(meta, 201)
    },
  )

  routes.patch('/documents/:id/files/:fileId', async (c) => {
    const { db } = ready()
    const body = await readJson(c, FilePatch)
    const id = docId(c.req.param('id'))
    const fileId = c.req.param('fileId')
    if (!Id.safeParse(fileId).success) throw new NotFoundError('Allegato non trovato')
    const meta = await db.tx((tx) => updateFile(tx, id, fileId, body))
    if (!meta) throw new NotFoundError('Allegato non trovato')
    return c.json(meta)
  })

  routes.delete('/documents/:id/files/:fileId', async (c) => {
    const { db } = ready()
    const id = docId(c.req.param('id'))
    const fileId = c.req.param('fileId')
    if (!Id.safeParse(fileId).success || !(await deleteFile(db, id, fileId))) {
      throw new NotFoundError('Allegato non trovato')
    }
    return c.body(null, 204)
  })

  // Il file in chiaro (DOC-012): inline per l'anteprima, con download=1
  // come allegato con il nome originale; variant=thumb per la miniatura.
  routes.get('/documents/:id/files/:fileId', async (c) => {
    const { db, vault: v } = ready()
    const id = docId(c.req.param('id'))
    const fileId = c.req.param('fileId')
    const meta = Id.safeParse(fileId).success ? await getFile(db, id, fileId) : null
    if (!meta) throw new NotFoundError('Allegato non trovato')
    const thumb = c.req.query('variant') === 'thumb'
    const content = await readContent(db, v, id, fileId, thumb ? 'thumb' : 'original')
    if (!content) throw new NotFoundError('Miniatura non disponibile')
    const disposition = c.req.query('download') === '1' ? 'attachment' : 'inline'
    return c.body(new Uint8Array(content), 200, {
      'Content-Type': thumb ? 'image/jpeg' : meta.mime,
      'Content-Length': String(content.length),
      'Content-Disposition': `${disposition}; filename*=UTF-8''${encodeURIComponent(meta.name)}`,
      'X-Content-Type-Options': 'nosniff',
    })
  })

  return routes
}

// Allegati dei documenti (DOC-011, DOC-012, DOC-014): contenuto e miniatura
// cifrati, tipo ricavato dai byte, limiti di 20 MB per file e 100 MB per
// documento.
import { randomUUID } from 'node:crypto'

import sharp from 'sharp'

import type { Queryable } from '../db.ts'
import type { Vault } from './crypto.ts'
import { fileAad, thumbAad } from './crypto.ts'
import { isImage, sniffMime } from './mime.ts'

export const MAX_FILE_BYTES = 20 * 1024 * 1024
export const MAX_DOCUMENT_BYTES = 100 * 1024 * 1024
export const LABELS = ['fronte', 'retro', 'pagina', 'altro'] as const
export type FileLabel = (typeof LABELS)[number]

// Lato lungo della miniatura, in pixel.
const THUMB_SIZE = 400

export type FileMeta = {
  id: string
  name: string
  mime: string
  size: number
  label: FileLabel
  position: number
  hasThumb: boolean
  createdAt: string
}

type MetaRow = {
  id: string
  name: string
  mime: string
  size: number
  label: FileLabel
  position: number
  has_thumb: boolean
  created_at: Date
}

const toMeta = (r: MetaRow): FileMeta => ({
  id: r.id,
  name: r.name,
  mime: r.mime,
  size: r.size,
  label: r.label,
  position: r.position,
  hasThumb: r.has_thumb,
  createdAt: r.created_at.toISOString(),
})

const META = `select id, name, mime, size, label, position, thumb is not null as has_thumb, created_at
                from document_files`

export class DocumentFullError extends Error {}

// Nome originale senza percorso né caratteri di controllo.
export function cleanName(name: string) {
  const base = name.split(/[\\/]/).pop() ?? ''
  // eslint-disable-next-line no-control-regex
  const clean = base.replace(/[\u0000-\u001f\u007f]/g, '').trim()
  return clean.slice(0, 200) || 'file'
}

// JPEG con il lato lungo di 400 px, girata secondo l'EXIF. null se sharp
// non sa leggere l'immagine (per esempio HEIC): il file resta, senza
// miniatura.
export async function makeThumb(content: Buffer): Promise<Buffer | null> {
  try {
    return await sharp(content)
      .rotate()
      .resize({ width: THUMB_SIZE, height: THUMB_SIZE, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer()
  } catch {
    return null
  }
}

export async function listFiles(db: Queryable, documentId: string): Promise<FileMeta[]> {
  const { rows } = await db.query<MetaRow>(`${META} where document_id = $1 order by position, created_at`, [
    documentId,
  ])
  return rows.map(toMeta)
}

export async function getFile(db: Queryable, documentId: string, fileId: string): Promise<FileMeta | null> {
  const { rows } = await db.query<MetaRow>(`${META} where document_id = $1 and id = $2`, [documentId, fileId])
  return rows[0] ? toMeta(rows[0]) : null
}

// In coda agli altri allegati. Il chiamante tiene la transazione e il lock
// sul documento, così due caricamenti insieme non superano i 100 MB.
export async function insertFile(
  db: Queryable,
  vault: Vault,
  documentId: string,
  input: { name: string; label: FileLabel; content: Buffer },
): Promise<FileMeta> {
  const { rows: used } = await db.query<{ total: number; next: number }>(
    `select coalesce(sum(size), 0)::int8 as total, coalesce(max(position) + 1, 0)::int as next
       from document_files where document_id = $1`,
    [documentId],
  )
  const { total, next } = used[0]
  if (total + input.content.length > MAX_DOCUMENT_BYTES) throw new DocumentFullError()

  const id = randomUUID()
  const mime = sniffMime(input.content)
  const thumb = isImage(mime) ? await makeThumb(input.content) : null
  const { rows } = await db.query<MetaRow>(
    `insert into document_files (id, document_id, name, mime, size, label, position, key_version, ciphertext, thumb)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     returning id, name, mime, size, label, position, thumb is not null as has_thumb, created_at`,
    [
      id,
      documentId,
      cleanName(input.name),
      mime,
      input.content.length,
      input.label,
      next,
      vault.keyVersion,
      vault.seal(input.content, fileAad(documentId, id)),
      thumb && vault.seal(thumb, thumbAad(documentId, id)),
    ],
  )
  await touch(db, documentId)
  return toMeta(rows[0])
}

// Contenuto in chiaro: l'originale o la miniatura.
export async function readContent(
  db: Queryable,
  vault: Vault,
  documentId: string,
  fileId: string,
  variant: 'original' | 'thumb',
): Promise<Buffer | null> {
  const column = variant === 'thumb' ? 'thumb' : 'ciphertext'
  const { rows } = await db.query<{ data: Buffer | null }>(
    `select ${column} as data from document_files where document_id = $1 and id = $2`,
    [documentId, fileId],
  )
  const data = rows[0]?.data
  if (!data) return null
  return vault.open(data, variant === 'thumb' ? thumbAad(documentId, fileId) : fileAad(documentId, fileId))
}

// Etichetta e posizione. La posizione è l'indice nella lista: gli altri
// allegati scalano.
export async function updateFile(
  db: Queryable,
  documentId: string,
  fileId: string,
  patch: { label?: FileLabel; position?: number },
): Promise<FileMeta | null> {
  const current = await listFiles(db, documentId)
  const index = current.findIndex((f) => f.id === fileId)
  if (index < 0) return null
  if (patch.label) {
    await db.query('update document_files set label = $3 where document_id = $1 and id = $2', [
      documentId,
      fileId,
      patch.label,
    ])
  }
  if (patch.position !== undefined) {
    const ids = current.map((f) => f.id)
    ids.splice(index, 1)
    ids.splice(Math.min(patch.position, ids.length), 0, fileId)
    await db.query(
      `update document_files f set position = o.position - 1
         from unnest($2::uuid[]) with ordinality as o(id, position)
        where f.document_id = $1 and f.id = o.id`,
      [documentId, ids],
    )
  }
  await touch(db, documentId)
  return getFile(db, documentId, fileId)
}

export async function deleteFile(db: Queryable, documentId: string, fileId: string) {
  const { rowCount } = await db.query('delete from document_files where document_id = $1 and id = $2', [
    documentId,
    fileId,
  ])
  if (!rowCount) return false
  await touch(db, documentId)
  return true
}

const touch = (db: Queryable, documentId: string) =>
  db.query('update documents set updated_at = now() where id = $1', [documentId])

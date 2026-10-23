// Immagine di sfondo (SET-003): una sola, al massimo 5 MB, JPEG, PNG o
// WebP. Il tipo si ricava dai primi byte, non dal nome del file.
import type { Queryable } from '../db.ts'
import { sniffMime } from '../documents/mime.ts'

export const MAX_BACKGROUND_BYTES = 5 * 1024 * 1024
export const BACKGROUND_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

// 413 file_too_large.
export class BackgroundTooLargeError extends Error {}

export function backgroundType(content: Buffer) {
  const mime = sniffMime(content)
  return BACKGROUND_TYPES.has(mime) ? mime : null
}

export async function getBackground(db: Queryable) {
  const { rows } = await db.query<{ mime: string; content: Buffer; updatedAt: Date }>(
    'select mime, content, updated_at as "updatedAt" from preference_background where id',
  )
  return rows[0] ?? null
}

export async function hasBackground(db: Queryable) {
  const { rowCount } = await db.query('select 1 from preference_background where id')
  return (rowCount ?? 0) > 0
}

export async function putBackground(db: Queryable, mime: string, content: Buffer) {
  await db.query(
    `insert into preference_background (id, mime, content) values (true, $1, $2)
     on conflict (id) do update set mime = excluded.mime, content = excluded.content, updated_at = now()`,
    [mime, content],
  )
}

export async function deleteBackground(db: Queryable) {
  await db.query('delete from preference_background where id')
}

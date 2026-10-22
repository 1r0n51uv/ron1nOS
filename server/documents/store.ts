// Lettura e scrittura dei documenti con la busta (DOC-015): campi del
// tipo, campi liberi e note entrano ed escono solo da qui, cifrati con
// AAD "document:<id>".
import { randomUUID } from 'node:crypto'

import type { Queryable } from '../db.ts'
import type { Vault } from './crypto.ts'
import { documentAad } from './crypto.ts'

export type ExtraField = { label: string; value: string }

// Il contenuto della busta.
export type Secret = {
  fields: Record<string, string>
  extra: ExtraField[]
  notes: string
}

export type DocumentInput = {
  typeId: string | null
  title: string
  holder: string
  expiresOn: string | null
  warnings: number[]
  tags: string[]
  pinned: boolean
} & Secret

export type StoredDocument = Omit<DocumentInput, 'pinned'> & {
  id: string
  pinnedAt: string | null
  createdAt: string
  updatedAt: string
}

type Row = {
  id: string
  type_id: string | null
  title: string
  holder: string
  expires_on: string | null
  warnings: number[]
  tags: string[]
  pinned_at: Date | null
  envelope: Buffer
  created_at: Date
  updated_at: Date
}

export async function insertDocument(db: Queryable, vault: Vault, input: DocumentInput) {
  const id = randomUUID()
  const secret: Secret = { fields: input.fields, extra: input.extra, notes: input.notes }
  await db.query(
    `insert into documents
       (id, type_id, title, holder, expires_on, warnings, tags, pinned_at, key_version, envelope)
     values ($1, $2, $3, $4, $5, $6, $7, case when $8 then now() end, $9, $10)`,
    [
      id,
      input.typeId,
      input.title,
      input.holder,
      input.expiresOn,
      input.warnings,
      input.tags,
      input.pinned,
      vault.keyVersion,
      vault.sealJson(secret, documentAad(id)),
    ],
  )
  return id
}

export async function readDocument(db: Queryable, vault: Vault, id: string): Promise<StoredDocument | null> {
  const { rows } = await db.query<Row>(
    `select id, type_id, title, holder, expires_on, warnings, tags, pinned_at, envelope, created_at, updated_at
       from documents where id = $1`,
    [id],
  )
  const r = rows[0]
  if (!r) return null
  const secret = vault.openJson<Secret>(r.envelope, documentAad(r.id))
  return {
    id: r.id,
    typeId: r.type_id,
    title: r.title,
    holder: r.holder,
    expiresOn: r.expires_on,
    warnings: r.warnings,
    tags: r.tags,
    pinnedAt: r.pinned_at?.toISOString() ?? null,
    ...secret,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  }
}

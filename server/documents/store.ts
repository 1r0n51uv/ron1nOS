// Lettura e scrittura dei documenti con la busta (DOC-015): campi del
// tipo, campi liberi e note entrano ed escono solo da qui, cifrati con
// AAD "document:<id>".
import { randomUUID } from 'node:crypto'

import type { Queryable } from '../db.ts'
import type { Vault } from './crypto.ts'
import { documentAad } from './crypto.ts'
import type { Expiry } from './status.ts'
import { expiryOf } from './status.ts'

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

// Una riga dell'elenco (DOC-002): niente valori dei campi, solo quello
// che sta in chiaro.
export type DocumentSummary = {
  id: string
  typeId: string | null
  typeName: string | null
  typeIcon: string | null
  title: string
  holder: string
  expiresOn: string | null
  expiry: Expiry
  tags: string[]
  pinnedAt: string | null
  files: number
  // Miniatura del primo allegato, se è un'immagine.
  thumbFileId: string | null
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

// Riscrive tutto il documento con una busta nuova. pinned: true lascia la
// data in cui era stato fissato, così l'ordine dell'evidenza non cambia.
export async function updateDocument(db: Queryable, vault: Vault, id: string, input: DocumentInput) {
  const secret: Secret = { fields: input.fields, extra: input.extra, notes: input.notes }
  await db.query(
    `update documents set
       type_id = $2, title = $3, holder = $4, expires_on = $5, warnings = $6, tags = $7,
       pinned_at = case when $8 then coalesce(pinned_at, now()) end,
       key_version = $9, envelope = $10, updated_at = now()
     where id = $1`,
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
}

// Definitiva (DOC-014): gli allegati se ne vanno con il documento.
export async function deleteDocument(db: Queryable, id: string) {
  const { rowCount } = await db.query('delete from documents where id = $1', [id])
  return (rowCount ?? 0) > 0
}

export type ListFilter = {
  q?: string
  // id di un tipo, oppure 'none' per i file senza tipo.
  type?: string
  holder?: string
}

type SummaryRow = Omit<Row, 'envelope' | 'created_at'> & {
  type_name: string | null
  type_icon: string | null
  files: number
  thumb_file_id: string | null
}

// Prima i fissati, nell'ordine in cui sono stati fissati (DOC-008), poi gli
// altri per titolo. La ricerca guarda titolo e tag, che sono in chiaro.
export async function listDocuments(
  db: Queryable,
  filter: ListFilter,
  now = new Date(),
): Promise<DocumentSummary[]> {
  const where: string[] = []
  const params: unknown[] = []
  if (filter.q) {
    params.push(`%${filter.q.replace(/[\\%_]/g, '\\$&')}%`)
    where.push(
      `(d.title ilike $${params.length} or exists (select 1 from unnest(d.tags) t where t ilike $${params.length}))`,
    )
  }
  if (filter.type === 'none') where.push('d.type_id is null')
  else if (filter.type) {
    params.push(filter.type)
    where.push(`d.type_id = $${params.length}`)
  }
  if (filter.holder) {
    params.push(filter.holder)
    where.push(`d.holder = $${params.length}`)
  }
  const { rows } = await db.query<SummaryRow>(
    `select d.id, d.type_id, t.name as type_name, t.icon as type_icon, d.title, d.holder,
            d.expires_on, d.warnings, d.tags, d.pinned_at, d.updated_at,
            (select count(*) from document_files f where f.document_id = d.id)::int as files,
            case when first.has_thumb then first.id end as thumb_file_id
       from documents d left join document_types t on t.id = d.type_id
       left join lateral (
         select f.id, f.thumb is not null as has_thumb from document_files f
          where f.document_id = d.id order by f.position, f.created_at limit 1
       ) first on true
      ${where.length ? `where ${where.join(' and ')}` : ''}
      order by d.pinned_at is null, d.pinned_at, lower(d.title), d.created_at`,
    params,
  )
  return rows.map((r) => ({
    id: r.id,
    typeId: r.type_id,
    typeName: r.type_name,
    typeIcon: r.type_icon,
    title: r.title,
    holder: r.holder,
    expiresOn: r.expires_on,
    expiry: expiryOf(r.expires_on, r.warnings, now),
    tags: r.tags,
    pinnedAt: r.pinned_at?.toISOString() ?? null,
    files: r.files,
    thumbFileId: r.thumb_file_id,
    updatedAt: r.updated_at.toISOString(),
  }))
}

// Titolari già usati (DOC-007), i più frequenti per primi.
export async function listHolders(db: Queryable): Promise<string[]> {
  const { rows } = await db.query<{ holder: string }>(
    'select holder from documents group by holder order by count(*) desc, holder',
  )
  return rows.map((r) => r.holder)
}

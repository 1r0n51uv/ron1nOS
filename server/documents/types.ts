// Tipi di documento (DOC-003): nome, icona e campi ordinati. Stanno nel
// database (i quattro già pronti entrano con la migrazione) così si
// configurano dalla UI (DOC-016). I nomi dei tipi e dei campi non sono
// dati sensibili: restano in chiaro.
import { z } from 'zod'

import type { Queryable } from '../db.ts'

export const FieldKind = z.enum(['text', 'date', 'code'])

export const TypeField = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/),
  label: z.string().trim().min(1).max(60),
  kind: FieldKind,
  copyable: z.boolean(),
})
export type TypeField = z.infer<typeof TypeField>

export type DocumentType = {
  id: string
  key: string | null
  name: string
  icon: string
  preset: boolean
  fields: TypeField[]
  documents: number
}

type Row = {
  id: string
  key: string | null
  name: string
  icon: string
  fields: TypeField[]
  documents: number
}

const toType = (r: Row): DocumentType => ({
  id: r.id,
  key: r.key,
  name: r.name,
  icon: r.icon,
  preset: r.key !== null,
  fields: r.fields,
  documents: r.documents,
})

const SELECT = `
  select t.id, t.key, t.name, t.icon, t.fields,
         (select count(*) from documents d where d.type_id = t.id)::int as documents
    from document_types t`

// Prima quelli già pronti, nell'ordine della migrazione, poi i creati per nome.
export async function listTypes(db: Queryable): Promise<DocumentType[]> {
  const { rows } = await db.query<Row>(`${SELECT} order by t.key is null, t.created_at, t.name`)
  return rows.map(toType)
}

export async function getType(db: Queryable, id: string): Promise<DocumentType | null> {
  const { rows } = await db.query<Row>(`${SELECT} where t.id = $1`, [id])
  return rows[0] ? toType(rows[0]) : null
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

// Valori dei campi di un documento contro il suo tipo: chiavi sconosciute
// rifiutate, date YYYY-MM-DD, vuoti tolti. Restituisce il messaggio
// d'errore o i valori puliti.
export function checkFields(
  type: Pick<DocumentType, 'fields'>,
  values: Record<string, string>,
): { ok: true; values: Record<string, string> } | { ok: false; message: string } {
  const byKey = new Map(type.fields.map((f) => [f.key, f]))
  const clean: Record<string, string> = {}
  for (const [key, raw] of Object.entries(values)) {
    const field = byKey.get(key)
    if (!field) return { ok: false, message: `Campo sconosciuto: ${key}` }
    const value = raw.trim()
    if (!value) continue
    if (value.length > 2000) return { ok: false, message: `${field.label}: troppo lungo` }
    if (field.kind === 'date' && (!ISO_DATE.test(value) || Number.isNaN(Date.parse(value)))) {
      return { ok: false, message: `${field.label}: data non valida` }
    }
    clean[key] = value
  }
  return { ok: true, values: clean }
}

// Cambio di tipo (DOC-003): i valori dei campi che il nuovo tipo non ha
// diventano campi liberi con l'etichetta del vecchio campo, così niente si
// perde. newType null: documento senza tipo, tutto diventa campo libero.
export function retype(
  values: Record<string, string>,
  oldType: Pick<DocumentType, 'fields'> | null,
  newType: Pick<DocumentType, 'fields'> | null,
): { fields: Record<string, string>; moved: { label: string; value: string }[] } {
  const kept = new Set(newType?.fields.map((f) => f.key) ?? [])
  const labels = new Map(oldType?.fields.map((f) => [f.key, f.label]) ?? [])
  const fields: Record<string, string> = {}
  const moved: { label: string; value: string }[] = []
  for (const [key, value] of Object.entries(values)) {
    if (kept.has(key)) fields[key] = value
    else moved.push({ label: labels.get(key) ?? key, value })
  }
  return { fields, moved }
}

// Icone tra cui scegliere per un tipo (DOC-016).
export const TYPE_ICONS = ['id-card', 'passport', 'car', 'health', 'file', 'card', 'person'] as const

// Un campo come arriva dalla UI: senza chiave se è nuovo.
export const FieldInput = TypeField.extend({ key: TypeField.shape.key.optional() })
export type FieldInput = z.infer<typeof FieldInput>

// Chiave stabile da un'etichetta: `Numero polizza` → `numero_polizza`.
export function keyFor(label: string, taken: Set<string>) {
  const base =
    label
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/^(?=[0-9])/, 'f_')
      .slice(0, 36) || 'campo'
  let key = base
  for (let i = 2; taken.has(key); i++) key = `${base}_${i}`
  taken.add(key)
  return key
}

// I campi nuovi del tipo: le chiavi esistenti restano, le nuove si
// generano. Una chiave che il tipo non ha è un errore.
export function resolveFields(
  current: TypeField[],
  input: FieldInput[],
): { ok: true; fields: TypeField[] } | { ok: false; message: string } {
  const known = new Set(current.map((f) => f.key))
  const taken = new Set(input.flatMap((f) => (f.key ? [f.key] : [])))
  if (taken.size !== input.filter((f) => f.key).length) return { ok: false, message: 'Campo ripetuto' }
  const fields: TypeField[] = []
  for (const f of input) {
    if (f.key && !known.has(f.key)) return { ok: false, message: `Campo sconosciuto: ${f.key}` }
    fields.push({ ...f, key: f.key ?? keyFor(f.label, taken) })
  }
  return { ok: true, fields }
}

// Valori di un documento dopo una modifica del tipo (DOC-016): quelli dei
// campi tolti, o che non sono più date valide, diventano campi liberi.
export function reshape(
  values: Record<string, string>,
  before: TypeField[],
  after: TypeField[],
): { fields: Record<string, string>; moved: { label: string; value: string }[] } {
  const now = new Map(after.map((f) => [f.key, f]))
  const labels = new Map(before.map((f) => [f.key, f.label]))
  const fields: Record<string, string> = {}
  const moved: { label: string; value: string }[] = []
  for (const [key, value] of Object.entries(values)) {
    const field = now.get(key)
    const fits =
      field && (field.kind !== 'date' || (ISO_DATE.test(value) && !Number.isNaN(Date.parse(value))))
    if (fits) fields[key] = value
    else moved.push({ label: labels.get(key) ?? key, value })
  }
  return { fields, moved }
}

export async function insertType(db: Queryable, input: { name: string; icon: string; fields: TypeField[] }) {
  const { rows } = await db.query<{ id: string }>(
    'insert into document_types (name, icon, fields) values ($1, $2, $3) returning id',
    [input.name, input.icon, JSON.stringify(input.fields)],
  )
  return rows[0].id
}

export async function saveType(
  db: Queryable,
  id: string,
  input: { name: string; icon: string; fields: TypeField[] },
) {
  await db.query(
    'update document_types set name = $2, icon = $3, fields = $4, updated_at = now() where id = $1',
    [id, input.name, input.icon, JSON.stringify(input.fields)],
  )
}

export async function deleteType(db: Queryable, id: string) {
  await db.query('delete from document_types where id = $1', [id])
}

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

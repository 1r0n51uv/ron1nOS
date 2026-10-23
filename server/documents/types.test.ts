// @vitest-environment node
import { randomBytes } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createApp } from '../app.ts'
import { hashPassword } from '../auth/password.ts'
import { testDb } from '../testing/db.ts'
import { fakeQbt } from '../testing/fake-qbt.ts'
import { createVault } from './crypto.ts'
import type { DocumentType } from './types.ts'
import { checkFields, keyFor, reshape, retype } from './types.ts'

let db: Awaited<ReturnType<typeof testDb>>
let passwordHash: string
beforeAll(async () => {
  db = await testDb()
  passwordHash = await hashPassword('password di prova')
})
afterAll(() => db.drop())

async function signedIn(app: ReturnType<typeof createApp>) {
  const res = await app.request('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: 'password di prova' }),
  })
  return res.headers.get('set-cookie')!.split(';')[0]
}

describe('GET /documents/types (DOC-003)', () => {
  it('i quattro tipi già pronti, con i loro campi in ordine', async () => {
    const app = createApp({
      qbt: fakeQbt(),
      database: { db, status: () => 'ok' },
      auth: { passwordHash },
      documents: { vault: createVault(randomBytes(32)) },
    })
    const res = await app.request('/api/v1/documents/types', { headers: { cookie: await signedIn(app) } })
    expect(res.status).toBe(200)
    const types = (await res.json()) as DocumentType[]
    expect(types.map((t) => t.key)).toEqual(['identity_card', 'passport', 'driving_license', 'health_card'])
    expect(types[0]).toMatchObject({ name: "Carta d'identità", preset: true, documents: 0 })
    expect(types[0].fields.map((f) => f.key)).toEqual([
      'number',
      'surname',
      'name',
      'birth_date',
      'birth_place',
      'issue_city',
      'issue_date',
      'tax_code',
    ])
    expect(types[0].fields[3]).toEqual({
      key: 'birth_date',
      label: 'Data di nascita',
      kind: 'date',
      copyable: true,
    })
  })

  it('senza DOCUMENTS_KEY il modulo è spento', async () => {
    const app = createApp({ qbt: fakeQbt(), database: { db, status: () => 'ok' }, auth: { passwordHash } })
    const res = await app.request('/api/v1/documents/types', { headers: { cookie: await signedIn(app) } })
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({
      error: 'documents_disabled',
      message: 'DOCUMENTS_KEY mancante o non valida',
    })
  })

  it('senza login il modulo è spento anche con la chiave', async () => {
    const app = createApp({
      qbt: fakeQbt(),
      database: { db, status: () => 'ok' },
      documents: { vault: createVault(randomBytes(32)) },
    })
    const res = await app.request('/api/v1/documents/types')
    expect(res.status).toBe(503)
    expect(await res.json()).toMatchObject({ message: 'Il modulo Documenti richiede il login' })
  })
})

describe('checkFields (DOC-003)', () => {
  const type = {
    fields: [
      { key: 'number', label: 'Numero', kind: 'code' as const, copyable: true },
      { key: 'issue_date', label: 'Data di rilascio', kind: 'date' as const, copyable: true },
    ],
  }

  it('pulisce i valori e toglie i vuoti', () => {
    expect(checkFields(type, { number: ' CA00000AA ', issue_date: '' })).toEqual({
      ok: true,
      values: { number: 'CA00000AA' },
    })
  })

  it('rifiuta chiavi sconosciute e date non valide', () => {
    expect(checkFields(type, { colore: 'blu' })).toEqual({ ok: false, message: 'Campo sconosciuto: colore' })
    expect(checkFields(type, { issue_date: '15/01/2017' })).toEqual({
      ok: false,
      message: 'Data di rilascio: data non valida',
    })
  })
})

describe('database (DOC-015)', () => {
  it('le tabelle non hanno colonne in chiaro per campi, note e contenuti', async () => {
    const { rows } = await db.query<{ table_name: string; column_name: string }>(
      `select table_name, column_name from information_schema.columns
        where table_schema = $1 and table_name in ('documents', 'document_files') order by 1, 2`,
      [db.schema],
    )
    const columns = rows.map((r) => `${r.table_name}.${r.column_name}`)
    expect(columns).toContain('documents.envelope')
    expect(columns).toContain('document_files.ciphertext')
    expect(columns.some((c) => /fields|notes|content|data$/.test(c))).toBe(false)
  })
})

describe('cambio di tipo (DOC-003)', () => {
  const a = {
    fields: [
      { key: 'number', label: 'Numero', kind: 'code' as const, copyable: true },
      { key: 'place', label: 'Luogo', kind: 'text' as const, copyable: true },
    ],
  }
  const b = { fields: [{ key: 'number', label: 'Numero', kind: 'code' as const, copyable: true }] }

  it('i valori che il nuovo tipo non ha diventano campi liberi con la loro etichetta', () => {
    expect(retype({ number: '1', place: 'Roma' }, a, b)).toEqual({
      fields: { number: '1' },
      moved: [{ label: 'Luogo', value: 'Roma' }],
    })
  })

  it('senza tipo tutto diventa libero; una chiave sconosciuta tiene la chiave come etichetta', () => {
    expect(retype({ number: '1', boh: 'x' }, a, null)).toEqual({
      fields: {},
      moved: [
        { label: 'Numero', value: '1' },
        { label: 'boh', value: 'x' },
      ],
    })
  })
})

describe('tipi personalizzati (DOC-016)', () => {
  it('chiavi dalle etichette, senza accenti e senza doppioni', () => {
    const taken = new Set(['numero'])
    expect(keyFor('Numero', taken)).toBe('numero_2')
    expect(keyFor('Città di rilascio', taken)).toBe('citta_di_rilascio')
    expect(keyFor('2° intestatario', taken)).toBe('f_2_intestatario')
    expect(keyFor('***', taken)).toBe('campo')
  })

  it('reshape: tolti e date non valide diventano liberi', () => {
    const before = [
      { key: 'a', label: 'A', kind: 'text' as const, copyable: true },
      { key: 'd', label: 'D', kind: 'text' as const, copyable: true },
    ]
    const after = [{ key: 'd', label: 'D', kind: 'date' as const, copyable: true }]
    expect(reshape({ a: '1', d: '2027-01-01' }, before, after)).toEqual({
      fields: { d: '2027-01-01' },
      moved: [{ label: 'A', value: '1' }],
    })
    expect(reshape({ d: 'marzo' }, before, after).moved).toEqual([{ label: 'D', value: 'marzo' }])
  })
})

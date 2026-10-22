// @vitest-environment node
import { randomBytes } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { testDb } from '../testing/db.ts'
import { createVault, EnvelopeError } from './crypto.ts'
import { insertDocument, readDocument } from './store.ts'

let db: Awaited<ReturnType<typeof testDb>>
beforeAll(async () => {
  db = await testDb()
})
afterAll(() => db.drop())

const vault = createVault(randomBytes(32))

const input = {
  typeId: null,
  title: 'Carta d’identità',
  holder: 'Io',
  expiresOn: '2027-04-12',
  warnings: [90, 30, 7],
  tags: ['identità'],
  pinned: true,
  fields: {},
  extra: [{ label: 'Numero CIE', value: 'CA00000AA' }],
  notes: 'nel cassetto',
}

describe('documenti cifrati a riposo (DOC-015)', () => {
  it('si rileggono uguali', async () => {
    const id = await insertDocument(db, vault, input)
    expect(await readDocument(db, vault, id)).toMatchObject({
      id,
      title: 'Carta d’identità',
      expiresOn: '2027-04-12',
      extra: [{ label: 'Numero CIE', value: 'CA00000AA' }],
      notes: 'nel cassetto',
    })
  })

  it('nel database ci sono solo ciphertext per campi e note', async () => {
    const id = await insertDocument(db, vault, input)
    const { rows } = await db.query('select * from documents where id = $1', [id])
    const dump = JSON.stringify(rows[0]) + rows[0].envelope.toString('latin1')
    expect(dump).not.toContain('CA00000AA')
    expect(dump).not.toContain('cassetto')
    expect(rows[0].key_version).toBe(1)
  })

  it('una busta copiata su un altro documento non si apre', async () => {
    const a = await insertDocument(db, vault, input)
    const b = await insertDocument(db, vault, { ...input, notes: 'altro' })
    await db.query(
      'update documents set envelope = (select envelope from documents where id = $1) where id = $2',
      [a, b],
    )
    await expect(readDocument(db, vault, b)).rejects.toThrow(EnvelopeError)
  })
})

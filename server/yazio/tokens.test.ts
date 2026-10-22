// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { testDb } from '../testing/db.ts'
import { dbTokenStore, decrypt, encrypt } from './tokens.ts'

describe('cifratura dei token', () => {
  it('cifra e decifra con la stessa chiave', () => {
    const value = encrypt('access-segreto', 'chiave')
    expect(value).not.toContain('access-segreto')
    expect(decrypt(value, 'chiave')).toBe('access-segreto')
  })

  it('due cifrature dello stesso testo sono diverse', () => {
    expect(encrypt('x', 'k')).not.toBe(encrypt('x', 'k'))
  })

  it('con un’altra chiave o un valore manomesso dà null', () => {
    const value = encrypt('access-segreto', 'chiave')
    expect(decrypt(value, 'altra')).toBeNull()
    expect(decrypt(value.slice(0, -4) + 'AAAA', 'chiave')).toBeNull()
    expect(decrypt('rotto', 'chiave')).toBeNull()
  })
})

describe('token in Postgres', () => {
  let db: Awaited<ReturnType<typeof testDb>>
  beforeAll(async () => {
    db = await testDb()
  })
  afterAll(() => db.drop())

  it('salva cifrato, rilegge in chiaro, una riga sola', async () => {
    const store = dbTokenStore(db, 'chiave')
    expect(await store.load()).toBeNull()
    const expiresAt = new Date('2026-10-24T10:00:00Z')
    await store.save({ accessToken: 'a-1', refreshToken: 'r-1', expiresAt })
    await store.save({ accessToken: 'a-2', refreshToken: 'r-2', expiresAt })
    expect(await store.load()).toEqual({ accessToken: 'a-2', refreshToken: 'r-2', expiresAt })
    const { rows } = await db.query('select * from yazio_tokens')
    expect(rows).toHaveLength(1)
    expect(JSON.stringify(rows)).not.toMatch(/a-2|r-2/)
  })

  it('con la chiave cambiata il token non si legge e si rifà il login', async () => {
    expect(await dbTokenStore(db, 'nuova').load()).toBeNull()
  })

  it('clear toglie il token', async () => {
    const store = dbTokenStore(db, 'chiave')
    await store.clear()
    expect(await store.load()).toBeNull()
  })
})

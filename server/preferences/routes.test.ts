// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createApp } from '../app.ts'
import type { Database } from '../db.ts'
import { testDb } from '../testing/db.ts'
import { fakeQbt } from '../testing/fake-qbt.ts'
import { DEFAULT_PREFERENCES } from './schema.ts'

let db: Awaited<ReturnType<typeof testDb>>
beforeAll(async () => {
  db = await testDb()
})
afterAll(() => db.drop())
beforeEach(() => db.query('delete from preferences'))

function api(database: Database = { db, status: () => 'ok' }) {
  const app = createApp({ qbt: fakeQbt(), database })
  const call = async (method: string, body?: unknown) => {
    const res = await app.request('/api/v1/preferences', {
      method,
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    return { status: res.status, body: JSON.parse(await res.text()) }
  }
  return { get: () => call('GET'), patch: (body: unknown) => call('PATCH', body) }
}

describe('rotte delle preferenze (SET-002)', () => {
  it('senza preferenze salvate restituisce i predefiniti', async () => {
    expect(await api().get()).toEqual({
      status: 200,
      body: { ...DEFAULT_PREFERENCES, updatedAt: null, stored: true },
    })
  })

  it('salva una modifica parziale e la rilegge', async () => {
    const res = await api().patch({ appearance: { density: 'compact' }, disabledModules: ['notes'] })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      appearance: { background: 'brace', glass: 'medium', density: 'compact' },
      disabledModules: ['notes'],
      stored: true,
    })
    expect(res.body.updatedAt).toEqual(expect.any(String))
    await api().patch({ formats: { energyUnit: 'kJ' } })
    const read = (await api().get()).body
    expect(read.appearance.density).toBe('compact')
    expect(read.disabledModules).toEqual(['notes'])
    expect(read.formats.energyUnit).toBe('kJ')
  })

  it('rifiuta con 400 valori non previsti, senza salvare', async () => {
    const res = await api().patch({ appearance: { glass: 'opaco' } })
    expect(res).toEqual({
      status: 400,
      body: { error: 'invalid_request', message: 'Campo non valido: appearance.glass' },
    })
    expect((await api().patch({ colore: 'rosso' })).status).toBe(400)
    expect((await api().get()).body.updatedAt).toBeNull()
  })

  it('senza database legge i predefiniti con stored false e non salva', async () => {
    const offline = api({ status: () => 'disabled' })
    expect((await offline.get()).body).toMatchObject({ ...DEFAULT_PREFERENCES, stored: false })
    expect((await offline.patch({ appearance: { glass: 'light' } })).status).toBe(503)
  })
})

// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createApp } from '../app.ts'
import { testDb } from '../testing/db.ts'
import { fakeQbt } from '../testing/fake-qbt.ts'
import { moduleOf } from './modules.ts'

let db: Awaited<ReturnType<typeof testDb>>
beforeAll(async () => {
  db = await testDb()
})
afterAll(() => db.drop())
beforeEach(() => db.query('delete from preferences'))

const app = () => createApp({ qbt: fakeQbt(), database: { db, status: () => 'ok' } })
const patch = (body: unknown) =>
  app().request('/api/v1/preferences', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

describe('moduli spenti (SET-005)', () => {
  it('riconosce il modulo dal prefisso della rotta', () => {
    expect(moduleOf('/api/v1/nutrition/days/2026-10-23')).toBe('nutrition')
    expect(moduleOf('/api/v1/downloads')).toBe('downloads')
    expect(moduleOf('/api/v1/server/stats')).toBe('server')
    expect(moduleOf('/api/v1/nutritionx')).toBeNull()
    expect(moduleOf('/api/v1/preferences')).toBeNull()
  })

  it('le rotte di un modulo spento rispondono 404 module_disabled, le altre no', async () => {
    expect((await app().request('/api/v1/downloads')).status).not.toBe(404)
    await patch({ disabledModules: ['downloads'] })
    const res = await app().request('/api/v1/downloads')
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'module_disabled', message: 'Modulo spento' })
    // Preferenze e dashboard restano raggiungibili per riaccenderlo.
    expect((await app().request('/api/v1/preferences')).status).toBe(200)
    expect((await app().request('/api/v1/dashboard/layouts/desktop')).status).toBe(200)
  })

  it('riacceso, il modulo risponde di nuovo', async () => {
    await patch({ disabledModules: ['downloads'] })
    await patch({ disabledModules: [] })
    expect((await app().request('/api/v1/downloads')).status).not.toBe(404)
  })
})

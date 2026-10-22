// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import type { Queryable } from '../db.ts'
import { testDb } from '../testing/db.ts'
import { createFakeYazio, FAKE_CLIENT, FAKE_USER } from '../testing/fake-yazio.ts'
import { nutritionApp, resetNutrition } from '../testing/nutrition.ts'
import {
  createYazioClient,
  YazioAuthError,
  YazioFormatError,
  YazioRateLimitError,
  YazioRequestError,
  YazioServerError,
  YazioUnreachableError,
} from '../yazio/client.ts'
import { dbTokenStore } from '../yazio/tokens.ts'
import { reason } from './yazio.ts'

let db: Awaited<ReturnType<typeof testDb>>
beforeAll(async () => {
  db = await testDb()
})
afterAll(() => db.drop())
beforeEach(() => resetNutrition(db))

const now = () => new Date('2026-10-22T10:12:00Z')

function setup() {
  const fake = createFakeYazio()
  const yazio = (q: Queryable) =>
    createYazioClient({
      url: 'http://yazio.test/v20',
      clientId: FAKE_CLIENT.id,
      clientSecret: FAKE_CLIENT.secret,
      username: FAKE_USER.username,
      password: FAKE_USER.password,
      tokens: dbTokenStore(q, 'chiave-di-prova'),
      fetch: fake.fetch as typeof fetch,
      sleep: async () => {},
    })
  return { fake, api: nutritionApp(db, { now, yazio }) }
}

describe('collegamento YAZIO (NUT-020)', () => {
  it('senza variabili nel .env risulta non configurato e Sincronizza ora è rifiutato', async () => {
    const api = nutritionApp(db, { now })
    expect((await api.get('/yazio')).body).toMatchObject({
      configured: false,
      state: 'disconnected',
      error: null,
      lastSyncAt: null,
      syncEnabled: true,
    })
    const res = await api.post('/yazio/sync')
    expect(res.status).toBe(409)
    expect(res.body.error).toBe('yazio_not_configured')
  })

  it('configurato ma mai sincronizzato: non collegato, poi collegato dopo un giro', async () => {
    const { api, fake } = setup()
    expect((await api.get('/yazio')).body).toMatchObject({ configured: true, state: 'disconnected' })
    const res = await api.post('/yazio/sync')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      configured: true,
      state: 'connected',
      error: null,
      lastSyncAt: '2026-10-22T10:12:00.000Z',
      syncEnabled: true,
    })
    expect(fake.state.calls.map((c) => c.path)).toContain('/v20/oauth/token')
    // Il token resta in Postgres, cifrato: le credenziali non escono mai.
    const { rows } = await db.query<{ access_token_enc: string }>('select access_token_enc from yazio_tokens')
    expect(rows[0]!.access_token_enc).not.toContain('access-')
    expect(JSON.stringify(res.body)).not.toContain(FAKE_USER.password)
  })

  it('credenziali rifiutate: errore con il motivo, e il giro dopo lo cancella', async () => {
    const { api, fake } = setup()
    fake.state.password = 'cambiata'
    const res = await api.post('/yazio/sync')
    expect(res.status).toBe(200)
    expect(res.body.state).toBe('error')
    expect(res.body.error).toMatch(/password/)
    expect(res.body.lastSyncAt).toBeNull()

    fake.state.password = FAKE_USER.password
    const again = await api.post('/yazio/sync')
    expect(again.body).toMatchObject({ state: 'connected', error: null })
  })

  it('YAZIO irraggiungibile dopo un giro riuscito: errore, ma resta l’ora dell’ultimo giro', async () => {
    const { api, fake } = setup()
    await api.post('/yazio/sync')
    fake.state.online = false
    const res = await api.post('/yazio/sync')
    expect(res.body).toMatchObject({
      state: 'error',
      error: 'YAZIO ha un problema (errore 503).',
      lastSyncAt: '2026-10-22T10:12:00.000Z',
    })
  })

  it('l’interruttore spegne la sincronizzazione senza perdere token né dati', async () => {
    const { api } = setup()
    await api.post('/yazio/sync')
    await api.post('/water', { date: '2026-10-22' })
    const off = await api.put('/yazio/sync', { enabled: false })
    expect(off.status).toBe(200)
    expect(off.body).toMatchObject({ syncEnabled: false, state: 'connected' })
    const res = await api.post('/yazio/sync')
    expect(res.status).toBe(409)
    expect(res.body.error).toBe('yazio_sync_off')
    expect((await db.query('select 1 from yazio_tokens')).rowCount).toBe(1)
    expect((await api.get('/day?date=2026-10-22')).body.waterMl).toBe(250)

    expect((await api.put('/yazio/sync', { enabled: true })).body.syncEnabled).toBe(true)
    expect((await api.post('/yazio/sync')).status).toBe(200)
  })

  it('rifiuta un interruttore senza booleano', async () => {
    const { api } = setup()
    expect((await api.put('/yazio/sync', { enabled: 'sì' })).status).toBe(400)
  })

  it('esegue i passi del giro in ordine e si ferma al primo errore', async () => {
    const { fake } = setup()
    const seen: string[] = []
    const api = nutritionApp(db, {
      now,
      yazio: (q) =>
        createYazioClient({
          url: 'http://yazio.test/v20',
          clientId: FAKE_CLIENT.id,
          clientSecret: FAKE_CLIENT.secret,
          username: FAKE_USER.username,
          password: FAKE_USER.password,
          tokens: dbTokenStore(q, 'chiave-di-prova'),
          fetch: fake.fetch as typeof fetch,
        }),
      syncSteps: [
        async ({ day }) => {
          seen.push(`lettura ${day}`)
        },
        async () => {
          throw new YazioFormatError('formato')
        },
        async () => {
          seen.push('invio')
        },
      ],
    })
    const res = await api.post('/yazio/sync')
    expect(seen).toEqual(['lettura 2026-10-22'])
    expect(res.body.error).toMatch(/adattatore/)
  })
})

describe('motivi degli errori', () => {
  it('ogni errore di YAZIO ha un motivo in italiano', () => {
    expect(reason(new YazioRateLimitError('x'))).toMatch(/rallentare/)
    expect(reason(new YazioServerError('x', 502))).toBe('YAZIO ha un problema (errore 502).')
    expect(reason(new YazioUnreachableError('x'))).toBe('YAZIO non raggiungibile.')
    expect(reason(new YazioRequestError('x', 404))).toMatch(/404/)
    expect(reason(new YazioAuthError('x'))).toMatch(/Apple o Google/)
    expect(reason(new Error('boom'))).toBe('Errore inatteso durante la sincronizzazione.')
  })
})

// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

import { createFakeYazio, FAKE_CLIENT, FAKE_USER } from '../testing/fake-yazio.ts'
import {
  createYazioClient,
  YazioAuthError,
  YazioFormatError,
  YazioRateLimitError,
  YazioServerError,
  YazioUnreachableError,
} from './client.ts'
import { memoryTokenStore } from './tokens.ts'

function setup({ now = () => Date.now(), store = memoryTokenStore() } = {}) {
  const fake = createFakeYazio()
  const sleep = vi.fn(async (_ms: number) => {})
  const client = createYazioClient({
    url: 'http://yazio.test/v20',
    clientId: FAKE_CLIENT.id,
    clientSecret: FAKE_CLIENT.secret,
    username: FAKE_USER.username,
    password: FAKE_USER.password,
    tokens: store,
    fetch: fake.fetch as typeof fetch,
    sleep,
    now,
  })
  const logins = () => fake.state.calls.filter((c) => c.path === '/v20/oauth/token').length
  return { fake, client, store, sleep, logins }
}

describe('autenticazione', () => {
  it('al primo uso fa il login con la password e salva il token', async () => {
    const { client, store, logins } = setup()
    await client.water('2026-10-22')
    expect(logins()).toBe(1)
    expect(store.current).toMatchObject({ accessToken: 'access-1', refreshToken: 'refresh-1' })
  })

  it('riusa il token salvato finché non sta per scadere', async () => {
    const { client, logins } = setup()
    await client.water('2026-10-22')
    await client.water('2026-10-21')
    expect(logins()).toBe(1)
  })

  it('rinnova con il refresh token prima della scadenza di 48 ore', async () => {
    let t = Date.now()
    const { client, fake, store } = setup({ now: () => t })
    await client.water('2026-10-22')
    t += 48 * 3_600_000 - 5 * 60_000
    await client.water('2026-10-22')
    const grants = fake.state.calls.filter((c) => c.path === '/v20/oauth/token')
    expect(grants).toHaveLength(2)
    expect(store.current?.accessToken).toBe('access-2')
  })

  it('se il refresh fallisce torna alla password', async () => {
    const store = memoryTokenStore({
      accessToken: 'vecchio',
      refreshToken: 'revocato',
      expiresAt: new Date(Date.now() - 1000),
    })
    const { client } = setup({ store })
    await client.water('2026-10-22')
    expect(store.current?.accessToken).toBe('access-1')
  })

  it('un token revocato (401) si rinnova una volta e la chiamata riesce', async () => {
    const store = memoryTokenStore({
      accessToken: 'revocato',
      refreshToken: 'revocato',
      expiresAt: new Date(Date.now() + 86_400_000),
    })
    const { client } = setup({ store })
    expect(await client.water('2026-10-22')).toBe(0)
    expect(store.current?.accessToken).toBe('access-1')
  })

  it('una password sbagliata dà YazioAuthError, senza credenziali nel messaggio', async () => {
    const { client, fake } = setup()
    fake.state.password = 'cambiata'
    const err = await client.water('2026-10-22').catch((e: Error) => e)
    expect(err).toBeInstanceOf(YazioAuthError)
    expect(String((err as Error).message)).not.toContain(FAKE_USER.password)
    expect(String((err as Error).message)).not.toContain(FAKE_USER.username)
  })

  it('chiamate in parallelo fanno un solo login', async () => {
    const { client, logins } = setup()
    await Promise.all([client.water('2026-10-22'), client.water('2026-10-21'), client.goals('2026-10-22')])
    expect(logins()).toBe(1)
  })
})

describe('errori e nuovi tentativi', () => {
  it('su 429 riprova con attesa crescente e poi riesce', async () => {
    const { client, fake, sleep } = setup()
    await client.login()
    fake.state.failNext = { status: 429, count: 2 }
    expect(await client.water('2026-10-22')).toBe(0)
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([1000, 2000])
  })

  it('429 che non passa diventa YazioRateLimitError', async () => {
    const { client, fake } = setup()
    await client.login()
    fake.state.failNext = { status: 429, count: 10 }
    await expect(client.water('2026-10-22')).rejects.toBeInstanceOf(YazioRateLimitError)
  })

  it('5xx che non passa diventa YazioServerError', async () => {
    const { client, fake, sleep } = setup()
    await client.login()
    fake.state.failNext = { status: 502, count: 10 }
    await expect(client.water('2026-10-22')).rejects.toBeInstanceOf(YazioServerError)
    expect(sleep).toHaveBeenCalledTimes(3)
  })

  it('rete giù diventa YazioUnreachableError', async () => {
    const sleep = vi.fn(async (_ms: number) => {})
    const client = createYazioClient({
      url: 'http://yazio.test/v20',
      clientId: 'x',
      clientSecret: 'y',
      username: 'u',
      password: 'p',
      tokens: memoryTokenStore(),
      fetch: (async () => {
        throw new TypeError('fetch failed')
      }) as typeof fetch,
      sleep,
    })
    await expect(client.water('2026-10-22')).rejects.toBeInstanceOf(YazioUnreachableError)
    expect(sleep).toHaveBeenCalledTimes(3)
  })

  it('un formato cambiato diventa yazio_format_changed, non un crash', async () => {
    const { client, fake } = setup()
    fake.state.consumed.push({
      id: 'c1',
      date: '2026-10-22 08:00:00',
      daytime: 'breakfast',
      product_id: 'p-mela',
      amount: 150,
      serving: null,
      serving_quantity: null,
    })
    fake.state.brokenFormat = true
    const err = await client.consumedItems('2026-10-22').catch((e: Error) => e)
    expect(err).toBeInstanceOf(YazioFormatError)
    expect((err as YazioFormatError).code).toBe('yazio_format_changed')
    expect((err as Error).message).toMatch(/consumed-items/)
  })
})

describe('chiamate', () => {
  it('diario: aggiunge con il nostro id, rilegge e cancella', async () => {
    const { client } = setup()
    const id = '0d5f2a1e-7c4b-4e8a-9f1d-3b2c1a0e9d8f'
    await client.addConsumedProducts([
      { id, productId: 'p-mela', date: '2026-10-22', daytime: 'snack', amount: 180 },
    ])
    const day = await client.consumedItems('2026-10-22')
    expect(day.products).toEqual([
      expect.objectContaining({ id, product_id: 'p-mela', daytime: 'snack', amount: 180 }),
    ])
    expect(day.recipe_portions).toEqual([])
    await client.deleteConsumedItems([id])
    expect((await client.consumedItems('2026-10-22')).products).toEqual([])
  })

  it("riepilogo del giorno con l'energia attiva già nell'obiettivo", async () => {
    const { client, fake } = setup()
    fake.state.activity['2026-10-22'] = 77
    const s = await client.dailySummary('2026-10-22')
    expect(s).toMatchObject({ activity_energy: 77, consume_activity_energy: true })
    expect(s.goals['energy.energy']).toBe(2098)
  })

  it('obiettivi di base ed esercizi', async () => {
    const { client, fake } = setup()
    fake.state.activity['2026-10-22'] = 300
    expect(await client.goals('2026-10-22')).toMatchObject({
      'energy.energy': 2021,
      'nutrient.protein': 126,
      'nutrient.carb': 227,
      'nutrient.fat': 67,
      water: 2500,
    })
    const ex = await client.exercises('2026-10-22')
    expect(ex.training.map((e) => e.energy)).toEqual([300])
  })

  it('acqua: si legge e si scrive il totale del giorno', async () => {
    const { client } = setup()
    await client.setWater('2026-10-22', 750)
    expect(await client.water('2026-10-22')).toBe(750)
  })

  it('peso: ultimo valore e storico', async () => {
    const { client, fake } = setup()
    expect(await client.lastWeight('2026-10-22')).toBeNull()
    fake.state.weights = [
      { date: '2026-09-22 07:00:00', value: 81.5 },
      { date: '2026-10-20 07:00:00', value: 80.1 },
    ]
    expect(await client.lastWeight('2026-10-22')).toMatchObject({ value: 80.1 })
    expect(await client.weightHistory('2026-09-01', '2026-10-22')).toHaveLength(2)
  })

  it('ricerca prodotti in Italia, anche per EAN, e dettaglio', async () => {
    const { client } = setup()
    const byName = await client.searchProducts('grissini')
    expect(byName.map((p) => p.name)).toEqual(['Grissini classici'])
    expect(byName[0].nutrients['energy.energy']).toBeCloseTo(4.12)
    const byEan = await client.searchProducts('5201054017111')
    expect(byEan.map((p) => p.product_id)).toEqual(['p-yogurt'])
    expect(await client.product('p-yogurt')).toMatchObject({ id: 'p-yogurt', eans: ['5201054017111'] })
    expect(await client.product('nessuno')).toBeNull()
  })
})

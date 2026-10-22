// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import type { Queryable } from '../db.ts'
import { testDb } from '../testing/db.ts'
import { createFakeYazio, FAKE_CLIENT, FAKE_USER } from '../testing/fake-yazio.ts'
import { nutritionApp, resetNutrition } from '../testing/nutrition.ts'
import { createYazioClient } from '../yazio/client.ts'
import { memoryTokenStore } from '../yazio/tokens.ts'

let db: Awaited<ReturnType<typeof testDb>>
beforeAll(async () => {
  db = await testDb()
})
afterAll(() => db.drop())
beforeEach(() => resetNutrition(db))

let clock = new Date('2026-10-22T10:12:00Z')
const now = () => clock

function setup() {
  clock = new Date('2026-10-22T10:12:00Z')
  const fake = createFakeYazio()
  const tokens = memoryTokenStore()
  const urls: string[] = []
  const yazio = (_: Queryable) =>
    createYazioClient({
      url: 'http://yazio.test/v20',
      clientId: FAKE_CLIENT.id,
      clientSecret: FAKE_CLIENT.secret,
      username: FAKE_USER.username,
      password: FAKE_USER.password,
      tokens,
      fetch: ((input: string, init?: RequestInit) => {
        urls.push(String(input))
        return fake.fetch(input, init)
      }) as typeof fetch,
      sleep: async () => {},
    })
  return { fake, urls, api: nutritionApp(db, { now, yazio }) }
}

describe('obiettivo, attività e peso da YAZIO (NUT-024)', () => {
  it('a ogni giro legge l’obiettivo e lo mostra come arrivato da YAZIO', async () => {
    const { api } = setup()
    const res = await api.post('/yazio/sync')
    expect(res.body.imported.goal).toMatchObject({
      source: 'yazio',
      kcal: 2021,
      protein: 126,
      carbs: 227,
      fat: 67,
      waterMl: 2500,
      effectiveFrom: '2026-10-22',
    })
    // Un secondo giro senza cambi non aggiunge righe.
    await api.post('/yazio/sync')
    expect((await api.get('/goals')).body.history).toHaveLength(1)
  })

  it('un obiettivo cambiato in YAZIO apre una riga nuova con la data del giorno', async () => {
    const { api, fake } = setup()
    await api.post('/yazio/sync')
    fake.state.goals = { ...fake.state.goals, kcal: 1900 }
    clock = new Date('2026-10-24T09:00:00Z')
    await api.post('/yazio/sync')
    const goals = (await api.get('/goals')).body
    expect(
      goals.history.map((g: { kcal: number; effectiveFrom: string }) => [g.effectiveFrom, g.kcal]),
    ).toEqual([
      ['2026-10-24', 1900],
      ['2026-10-22', 2021],
    ])
    // Lo storico resta: il 23 vale ancora quello vecchio.
    expect((await api.get('/goals?date=2026-10-23')).body.current.kcal).toBe(2021)
  })

  it('un obiettivo a mano viene sostituito da quello di YAZIO, poi non si modifica più', async () => {
    const { api } = setup()
    expect((await api.post('/goals', { kcal: 1800, protein: 100, carbs: 200, fat: 60 })).status).toBe(201)
    expect((await api.get('/goals')).body.editable).toBe(true)
    await api.post('/yazio/sync')
    const goals = (await api.get('/goals')).body
    expect(goals.current).toMatchObject({ source: 'yazio', kcal: 2021 })
    expect(goals.editable).toBe(false)
    const res = await api.post('/goals', { kcal: 1700, protein: 100, carbs: 200, fat: 60 })
    expect(res.status).toBe(409)
    expect(res.body.error).toBe('goals_from_yazio')
  })

  it('con la sincronizzazione spenta l’obiettivo torna modificabile a mano', async () => {
    const { api } = setup()
    await api.post('/yazio/sync')
    await api.put('/yazio/sync', { enabled: false })
    expect((await api.get('/goals')).body.editable).toBe(true)
    expect((await api.post('/goals', { kcal: 1700, protein: 100, carbs: 200, fat: 60 })).status).toBe(201)
  })

  it('senza un giro riuscito l’obiettivo resta modificabile', async () => {
    const { api, fake } = setup()
    fake.state.password = 'cambiata'
    await api.post('/yazio/sync')
    expect((await api.get('/goals')).body.editable).toBe(true)
  })

  it('legge l’energia attiva di oggi e di ieri', async () => {
    const { api, fake } = setup()
    fake.state.activity = { '2026-10-21': 310, '2026-10-22': 77 }
    const res = await api.post('/yazio/sync')
    expect(res.body.imported.activityKcal).toBe(77)
    const { rows } = await db.query('select day, active_kcal, counted from day_activity order by day')
    expect(rows).toEqual([
      { day: '2026-10-21', active_kcal: 310, counted: true },
      { day: '2026-10-22', active_kcal: 77, counted: true },
    ])
  })

  it('importa lo storico delle pesate al primo giro, poi solo le nuove', async () => {
    const { api, fake, urls } = setup()
    fake.state.weights = [
      { date: '2024-03-01 08:00:00', value: 84.2 },
      { date: '2026-10-20 08:00:00', value: 80.1 },
    ]
    const first = await api.post('/yazio/sync')
    expect(first.body.imported.weight).toEqual({ day: '2026-10-20', kg: 80.1 })
    expect((await db.query('select 1 from body_weights')).rowCount).toBe(2)
    expect(urls.find((u) => u.includes('/bodyvalues/weight?'))).toContain('start=2021-10-23')

    fake.state.weights.push({ date: '2026-10-22 07:30:00', value: 79.8 })
    urls.length = 0
    const second = await api.post('/yazio/sync')
    expect(second.body.imported.weight).toEqual({ day: '2026-10-22', kg: 79.8 })
    // Dall'ultima pesata meno una settimana, non di nuovo tutto lo storico.
    expect(urls.find((u) => u.includes('/bodyvalues/weight?'))).toContain('start=2026-10-13')
    expect((await db.query('select 1 from body_weights')).rowCount).toBe(3)
  })

  it('senza YAZIO non arriva niente', async () => {
    const api = nutritionApp(db, { now })
    expect((await api.get('/yazio')).body.imported).toEqual({ goal: null, activityKcal: null, weight: null })
  })
})

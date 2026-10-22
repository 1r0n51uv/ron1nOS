// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { testDb } from '../testing/db.ts'
import { nutritionApp, resetNutrition } from '../testing/nutrition.ts'
import { fakeYazioDeps } from '../testing/yazio.ts'
import { hasPending } from './diarywrite.ts'
import { FLUSH_STEPS, SYNC_STEPS } from './fromyazio.ts'
import { createSyncRunner } from './yazio.ts'

let db: Awaited<ReturnType<typeof testDb>>
beforeAll(async () => {
  db = await testDb()
})
afterAll(() => db.drop())
beforeEach(() => resetNutrition(db))

const DAY = '2026-10-22'
const now = () => new Date(`${DAY}T10:12:00Z`)

async function setup() {
  const { fake, yazio } = fakeYazioDeps()
  const api = nutritionApp(db, { now, yazio })
  // Collegato: un primo giro riuscito.
  expect((await api.post('/yazio/sync')).body.state).toBe('connected')
  return { fake, yazio, api }
}

type Api = Awaited<ReturnType<typeof setup>>['api']

const candidate = (over: Record<string, unknown>) => ({
  source: 'usda',
  externalId: String(Math.random()),
  name: 'Mela',
  kcal: 52,
  protein: 0.3,
  carbs: 14,
  fat: 0.2,
  ...over,
})

async function log(api: Api, slot: string, food: Record<string, unknown>, grams: number, date = DAY) {
  const res = await api.post('/meals', { date, slot, items: [{ food, grams }] })
  expect(res.status).toBe(201)
  const items = res.body.slots.find((s: { slot: string }) => s.slot === slot).meal.items
  return items.at(-1) as { id: string; sync: string; foodId: string }
}

async function item(api: Api, id: string, date = DAY) {
  const day = (await api.get(`/day?date=${date}`)).body
  for (const s of day.slots) for (const i of s.meal?.items ?? []) if (i.id === id) return i
  return null
}

describe('scrittura sul diario YAZIO (NUT-023)', () => {
  it('un alimento preso da YAZIO va come prodotto, con lo stesso id', async () => {
    const { api, fake } = await setup()
    const row = await log(
      api,
      'afternoon_snack',
      candidate({
        source: 'yazio',
        externalId: 'p-grissini',
        name: 'Grissini classici',
        yazioProductId: 'p-grissini',
      }),
      20,
    )
    expect(row.sync).toBe('pending')
    await api.post('/yazio/sync')
    expect(fake.state.consumed).toEqual([
      expect.objectContaining({ id: row.id, product_id: 'p-grissini', daytime: 'snack', amount: 20 }),
    ])
    expect((await item(api, row.id)).sync).toBe('synced')
    // Il giro dopo non la rimanda e non la duplica.
    fake.state.calls = []
    await api.post('/yazio/sync')
    expect(
      fake.state.calls.filter((c) => c.method === 'POST' && c.path === '/v20/user/consumed-items'),
    ).toEqual([])
    expect((await api.get(`/day?date=${DAY}`)).body.slots[3].meal.items).toHaveLength(1)
  })

  it('OpenFoodFacts va come l’equivalente YAZIO per codice a barre, e l’abbinamento resta', async () => {
    const { api, fake } = await setup()
    const row = await log(
      api,
      'breakfast',
      candidate({
        source: 'openfoodfacts',
        name: 'Yogurt greco',
        brand: 'Fage',
        barcode: '5201054017111',
        kcal: 73,
      }),
      170,
    )
    await api.post('/yazio/sync')
    expect(fake.state.consumed[0]).toMatchObject({ id: row.id, product_id: 'p-yogurt', daytime: 'breakfast' })
    const { rows } = await db.query('select yazio_product_id, yazio_matched_by from foods where id = $1', [
      row.foodId,
    ])
    expect(rows[0]).toEqual({ yazio_product_id: 'p-yogurt', yazio_matched_by: 'barcode' })
  })

  it('senza codice a barre si cerca per nome', async () => {
    const { api, fake } = await setup()
    await log(api, 'lunch', candidate({ name: 'Mela' }), 150)
    await api.post('/yazio/sync')
    expect(fake.state.consumed[0]).toMatchObject({ product_id: 'p-mela', daytime: 'lunch', amount: 150 })
  })

  it('senza equivalente la riga resta in ron1nOS e si abbina a mano', async () => {
    const { api, fake } = await setup()
    const row = await log(api, 'dinner', candidate({ name: 'Zuppa del casale', kcal: 80 }), 300)
    const res = await api.post('/yazio/sync')
    expect(res.body.unmatched).toBe(1)
    expect(fake.state.consumed).toEqual([])
    expect((await item(api, row.id)).sync).toBe('unmatched')
    const list = (await api.get('/yazio/unmatched')).body.foods
    expect(list).toEqual([
      {
        food: expect.objectContaining({ id: row.foodId, name: 'Zuppa del casale', kcal: 80 }),
        rows: 1,
        last: { day: DAY, slot: 'dinner', grams: 300 },
      },
    ])
    // La ricerca nel catalogo YAZIO per scegliere.
    const products = (await api.get('/yazio/products?q=mela')).body.products
    expect(products.map((p: { yazioProductId: string }) => p.yazioProductId)).toEqual(['p-mela'])

    expect((await api.put(`/foods/${row.foodId}/yazio`, { productId: 'p-mela' })).body.foods).toEqual([])
    await api.post('/yazio/sync')
    expect(fake.state.consumed[0]).toMatchObject({ id: row.id, product_id: 'p-mela' })
    expect((await item(api, row.id)).sync).toBe('synced')
    // La prossima volta parte da solo.
    const res2 = await api.post('/meals', {
      date: DAY,
      slot: 'dinner',
      items: [{ foodId: row.foodId, grams: 200 }],
    })
    const again = res2.body.slots[4].meal.items.at(-1)
    await api.post('/yazio/sync')
    expect(fake.state.consumed.map((c) => c.id)).toContain(again.id)
  })

  it('Lascia solo in ron1nOS: la riga non va e non chiede più un abbinamento', async () => {
    const { api, fake } = await setup()
    const row = await log(api, 'dinner', candidate({ name: 'Zuppa del casale' }), 300)
    await api.post('/yazio/sync')
    await api.put(`/foods/${row.foodId}/yazio`, { productId: null })
    const res = await api.post('/yazio/sync')
    expect(res.body).toMatchObject({ unmatched: 0, queue: 0 })
    expect((await item(api, row.id)).sync).toBe('local')
    expect(fake.state.consumed).toEqual([])
  })

  it('una correzione e una cancellazione in ron1nOS arrivano a YAZIO', async () => {
    const { api, fake } = await setup()
    const row = await log(api, 'lunch', candidate({ name: 'Mela' }), 150)
    await api.post('/yazio/sync')
    await api.patch(`/meals/items/${row.id}`, { grams: 200 })
    expect((await item(api, row.id)).sync).toBe('pending')
    expect((await api.get('/yazio')).body.queue).toBe(1)
    await api.post('/yazio/sync')
    expect(fake.state.consumed[0]).toMatchObject({ id: row.id, amount: 200 })

    expect((await api.delete(`/meals/items/${row.id}`)).status).toBe(200)
    expect((await api.get('/yazio')).body.queue).toBe(1)
    await api.post('/yazio/sync')
    expect(fake.state.consumed).toEqual([])
    expect((await db.query('select 1 from yazio_deletions')).rowCount).toBe(0)
  })

  it('l’acqua va come totale del giorno', async () => {
    const { api, fake } = await setup()
    await api.post('/water', { date: DAY, ml: 250 })
    await api.post('/yazio/sync')
    expect(fake.state.water[DAY]).toBe(250)
    await api.post('/water', { date: DAY, ml: 500 })
    await api.post('/yazio/sync')
    expect(fake.state.water[DAY]).toBe(750)
    await api.delete(`/water/last?date=${DAY}`)
    await api.delete(`/water/last?date=${DAY}`)
    await api.post('/yazio/sync')
    expect(fake.state.water[DAY]).toBe(0)
  })

  it('YAZIO giù: la riga resta in coda, il diario va avanti, poi parte', async () => {
    const { api, fake } = await setup()
    fake.state.online = false
    const row = await log(api, 'lunch', candidate({ name: 'Mela' }), 150)
    const res = await api.post('/yazio/sync')
    expect(res.body.state).toBe('error')
    expect((await item(api, row.id)).sync).toBe('pending')
    fake.state.online = true
    await api.post('/yazio/sync')
    expect(fake.state.consumed.map((c) => c.id)).toEqual([row.id])
  })

  it('una riga rifiutata da YAZIO va in errore senza fermare le altre', async () => {
    const { api, fake } = await setup()
    const bad = await log(
      api,
      'lunch',
      candidate({ source: 'yazio', externalId: 'p-sparito', name: 'Sparito', yazioProductId: 'p-sparito' }),
      100,
    )
    const good = await log(api, 'dinner', candidate({ name: 'Mela' }), 150)
    const res = await api.post('/yazio/sync')
    expect(res.body.state).toBe('connected')
    expect((await item(api, bad.id)).sync).toBe('error')
    expect(fake.state.consumed.map((c) => c.id)).toEqual([good.id])
  })

  it('con la sincronizzazione spenta le righe restano solo in ron1nOS', async () => {
    const { api, fake } = await setup()
    await api.put('/yazio/sync', { enabled: false })
    const row = await log(api, 'lunch', candidate({ name: 'Mela' }), 150)
    expect(row.sync).toBe('local')
    expect((await api.get('/yazio')).body.queue).toBe(0)
    expect(fake.state.consumed).toEqual([])
  })

  it('lo storico di prima del collegamento non parte', async () => {
    const { fake, yazio } = fakeYazioDeps()
    const api = nutritionApp(db, { now, yazio })
    await log(api, 'lunch', candidate({ name: 'Mela' }), 150, '2026-10-20')
    const today = await log(api, 'lunch', candidate({ name: 'Mela' }), 100)
    await api.post('/yazio/sync')
    expect(fake.state.consumed.map((c) => c.id)).toEqual([today.id])
  })
})

describe('invio di ogni minuto', () => {
  it('parte solo con qualcosa in coda', async () => {
    const { api, fake, yazio } = await setup()
    const runner = createSyncRunner({ yazio, steps: SYNC_STEPS, flushSteps: FLUSH_STEPS, hasPending, now })
    expect(await runner.flush(db)).toBeNull()
    const row = await log(api, 'lunch', candidate({ name: 'Mela' }), 150)
    expect(await hasPending(db, DAY)).toBe(true)
    expect(await runner.flush(db)).toBe(true)
    expect(fake.state.consumed.map((c) => c.id)).toEqual([row.id])
    expect(await hasPending(db, DAY)).toBe(false)
  })
})

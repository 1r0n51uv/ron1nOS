// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { testDb } from '../testing/db.ts'
import { nutritionApp, resetNutrition } from '../testing/nutrition.ts'
import { fakeYazioDeps } from '../testing/yazio.ts'
import { daytimeFor, slotFor } from './diaryread.ts'
import { SYNC_STEPS } from './fromyazio.ts'
import { createSyncRunner } from './yazio.ts'

let db: Awaited<ReturnType<typeof testDb>>
beforeAll(async () => {
  db = await testDb()
})
afterAll(() => db.drop())
beforeEach(() => resetNutrition(db))

const now = () => new Date('2026-10-22T10:12:00Z')
const ID = (n: number) => `00000000-0000-4000-8000-00000000000${n}`

function setup() {
  const { fake, yazio } = fakeYazioDeps()
  return { fake, api: nutritionApp(db, { now, yazio }) }
}

type Consumed = {
  id: string
  date: string
  daytime: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  product_id: string
  amount: number
}
const consumed = (n: number, over: Partial<Consumed> = {}) => ({
  id: ID(n),
  date: '2026-10-22 08:30:00',
  daytime: 'breakfast' as const,
  product_id: 'p-yogurt',
  amount: 170,
  serving: null,
  serving_quantity: null,
  ...over,
})

type Item = { id: string; name: string; grams: number; kcal: number; origin: string; sync: string }
const items = async (api: ReturnType<typeof setup>['api'], date: string, slot: string): Promise<Item[]> =>
  (await api.get(`/day?date=${date}`)).body.slots.find((s: { slot: string }) => s.slot === slot).meal
    ?.items ?? []

describe('lettura dal diario YAZIO (NUT-022)', () => {
  it('le voci nuove di YAZIO entrano nel diario con fonte YAZIO', async () => {
    const { api, fake } = setup()
    fake.state.consumed = [consumed(1)]
    const res = await api.post('/yazio/sync')
    expect(res.body.state).toBe('connected')
    const [item] = await items(api, '2026-10-22', 'breakfast')
    expect(item).toMatchObject({ id: ID(1), grams: 170, origin: 'yazio', sync: 'synced' })
    expect(item.name).toMatch(/Yogurt greco bianco 2%/)
    expect(item.kcal).toBe(124)
    // Un secondo giro non la duplica.
    await api.post('/yazio/sync')
    expect(await items(api, '2026-10-22', 'breakfast')).toHaveLength(1)
  })

  it('legge gli ultimi 3 giorni, non oltre', async () => {
    const { api, fake } = setup()
    fake.state.consumed = [
      consumed(1, { date: '2026-10-20 13:00:00', daytime: 'lunch' }),
      consumed(2, { date: '2026-10-19 13:00:00', daytime: 'lunch' }),
    ]
    await api.post('/yazio/sync')
    expect(await items(api, '2026-10-20', 'lunch')).toHaveLength(1)
    expect(await items(api, '2026-10-19', 'lunch')).toHaveLength(0)
  })

  it('lo spuntino diventa Spuntino prima delle 15 e Merenda dopo', async () => {
    const { api, fake } = setup()
    fake.state.consumed = [
      consumed(1, { date: '2026-10-22 10:30:00', daytime: 'snack', product_id: 'p-mela', amount: 150 }),
      consumed(2, { date: '2026-10-22 16:30:00', daytime: 'snack', product_id: 'p-grissini', amount: 20 }),
    ]
    await api.post('/yazio/sync')
    expect((await items(api, '2026-10-22', 'morning_snack')).map((i) => i.id)).toEqual([ID(1)])
    expect((await items(api, '2026-10-22', 'afternoon_snack')).map((i) => i.id)).toEqual([ID(2)])
  })

  it('una voce cancellata in YAZIO sparisce anche qui', async () => {
    const { api, fake } = setup()
    fake.state.consumed = [consumed(1), consumed(2, { product_id: 'p-mela', amount: 100 })]
    await api.post('/yazio/sync')
    fake.state.consumed = [consumed(2, { product_id: 'p-mela', amount: 100 })]
    await api.post('/yazio/sync')
    expect((await items(api, '2026-10-22', 'breakfast')).map((i) => i.id)).toEqual([ID(2)])
    fake.state.consumed = []
    await api.post('/yazio/sync')
    const day = (await api.get('/day?date=2026-10-22')).body
    expect(day.slots.find((s: { slot: string }) => s.slot === 'breakfast').state).toBe('empty')
  })

  it('le righe registrate in ron1nOS e mai viste da YAZIO restano', async () => {
    const { api, fake } = setup()
    const meal = await api.post('/meals', {
      date: '2026-10-22',
      slot: 'lunch',
      items: [
        {
          food: {
            source: 'usda',
            externalId: '1',
            name: 'Riso',
            kcal: 360,
            protein: 7,
            carbs: 79,
            fat: 1,
          },
          grams: 80,
        },
      ],
    })
    expect(meal.status).toBe(201)
    fake.state.consumed = []
    await api.post('/yazio/sync')
    expect(await items(api, '2026-10-22', 'lunch')).toHaveLength(1)
  })

  it('conflitti: una voce cambiata in YAZIO vince sulla riga di ron1nOS', async () => {
    const { api, fake } = setup()
    fake.state.consumed = [consumed(1)]
    await api.post('/yazio/sync')
    // Corretta in ron1nOS e in YAZIO fra due letture: vince YAZIO.
    expect((await api.patch(`/meals/items/${ID(1)}`, { grams: 200 })).status).toBe(200)
    fake.state.consumed = [consumed(1, { amount: 250, daytime: 'lunch', date: '2026-10-22 13:00:00' })]
    await api.post('/yazio/sync')
    expect(await items(api, '2026-10-22', 'breakfast')).toEqual([])
    const [item] = await items(api, '2026-10-22', 'lunch')
    expect(item).toMatchObject({ id: ID(1), grams: 250, sync: 'synced' })
    expect(item.kcal).toBe(183)
  })

  it('una modifica locale resta se YAZIO non ha cambiato la voce', async () => {
    const { api, fake } = setup()
    fake.state.consumed = [consumed(1)]
    await api.post('/yazio/sync')
    await api.patch(`/meals/items/${ID(1)}`, { grams: 200 })
    await api.post('/yazio/sync')
    expect((await items(api, '2026-10-22', 'breakfast'))[0].grams).toBe(200)
  })

  it('una voce spostata di giorno in YAZIO si sposta, non si duplica', async () => {
    const { api, fake } = setup()
    fake.state.consumed = [consumed(1)]
    await api.post('/yazio/sync')
    fake.state.consumed = [consumed(1, { date: '2026-10-21 08:30:00' })]
    await api.post('/yazio/sync')
    expect(await items(api, '2026-10-22', 'breakfast')).toEqual([])
    expect((await items(api, '2026-10-21', 'breakfast')).map((i) => i.id)).toEqual([ID(1)])
  })

  it('acqua: vale il totale del giorno di YAZIO', async () => {
    const { api, fake } = setup()
    await api.post('/water', { date: '2026-10-22', ml: 250 })
    fake.state.water = { '2026-10-22': 1500, '2026-10-21': 2000 }
    await api.post('/yazio/sync')
    expect((await api.get('/day?date=2026-10-22')).body.waterMl).toBe(1500)
    expect((await api.get('/day?date=2026-10-21')).body.waterMl).toBe(2000)
    // Acqua aggiunta qui e YAZIO fermo: resta quella locale (l'invio la porta là).
    await api.post('/water', { date: '2026-10-22', ml: 250 })
    await api.post('/yazio/sync')
    expect((await api.get('/day?date=2026-10-22')).body.waterMl).toBe(1750)
  })

  it('un prodotto che YAZIO non conosce più si salta senza fermare il giro', async () => {
    const { api, fake } = setup()
    fake.state.consumed = [consumed(1, { product_id: 'p-sparito' }), consumed(2, { product_id: 'p-mela' })]
    const res = await api.post('/yazio/sync')
    expect(res.body.state).toBe('connected')
    expect((await items(api, '2026-10-22', 'breakfast')).map((i) => i.id)).toEqual([ID(2)])
  })

  it('un formato cambiato ferma il giro senza toccare il diario', async () => {
    const { api, fake } = setup()
    fake.state.consumed = [consumed(1)]
    await api.post('/yazio/sync')
    fake.state.brokenFormat = true
    const res = await api.post('/yazio/sync')
    expect(res.body.state).toBe('error')
    expect(await items(api, '2026-10-22', 'breakfast')).toHaveLength(1)
  })
})

describe('slot e momenti di YAZIO', () => {
  it('fa andata e ritorno', () => {
    expect(slotFor('breakfast', '2026-10-22 08:00:00')).toBe('breakfast')
    expect(slotFor('snack', '2026-10-22 14:59:00')).toBe('morning_snack')
    expect(slotFor('snack', '2026-10-22 15:00:00')).toBe('afternoon_snack')
    expect(daytimeFor('afternoon_snack')).toBe('snack')
    expect(daytimeFor('dinner')).toBe('dinner')
  })
})

describe('giro periodico', () => {
  it('parte solo con YAZIO configurato e la sincronizzazione accesa', async () => {
    const { fake, yazio } = fakeYazioDeps()
    fake.state.consumed = [consumed(1)]
    const api = nutritionApp(db, { now, yazio })
    const runner = createSyncRunner({ yazio, steps: SYNC_STEPS, now })
    expect(await createSyncRunner({ steps: SYNC_STEPS }).tick(db)).toBeNull()
    await api.put('/yazio/sync', { enabled: false })
    expect(await runner.tick(db)).toBeNull()
    await api.put('/yazio/sync', { enabled: true })
    expect(await runner.tick(db)).toBe(true)
    expect(await items(api, '2026-10-22', 'breakfast')).toHaveLength(1)
  })
})

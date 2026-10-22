// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { testDb } from '../testing/db.ts'
import { createFakeFoods, FAKE_FOODS_CONFIG } from '../testing/fake-foods.ts'
import { nutritionApp, resetNutrition } from '../testing/nutrition.ts'
import { fakeYazioDeps } from '../testing/yazio.ts'
import { createExternalSearch } from './foodsearch.ts'
import { fromYazioProduct } from './yaziosearch.ts'

let db: Awaited<ReturnType<typeof testDb>>
beforeAll(async () => {
  db = await testDb()
})
afterAll(() => db.drop())
beforeEach(() => resetNutrition(db))

const now = () => new Date('2026-10-22T10:12:00Z')

function setup() {
  const foods = createFakeFoods()
  const external = createExternalSearch(FAKE_FOODS_CONFIG(), { fetch: foods.fetch as typeof fetch })
  const { fake, yazio } = fakeYazioDeps()
  return { fake, api: nutritionApp(db, { now, external, yazio }) }
}

type Result = { name: string; source: string; yazioProductId: string | null; kcal: number }

describe('catalogo YAZIO nella ricerca (NUT-021)', () => {
  it('con YAZIO collegato la ricerca include i prodotti YAZIO italiani, in coda', async () => {
    const { api, fake } = setup()
    await api.post('/yazio/sync')
    const res = await api.get('/foods/search?q=grissini')
    const yazio = res.body.results.filter((r: Result) => r.source === 'yazio')
    expect(yazio).toEqual([
      expect.objectContaining({
        name: 'Grissini classici',
        brand: 'Mulino Bianco',
        yazioProductId: 'p-grissini',
        kcal: 412,
        protein: 12,
      }),
    ])
    expect(res.body.results.at(-1).source).toBe('yazio')
    const call = fake.state.calls.find((c) => c.path === '/v20/products/search')
    expect(call).toBeDefined()
  })

  it('i prodotti di altri paesi restano fuori', async () => {
    const { api } = setup()
    await api.post('/yazio/sync')
    const res = await api.get('/foods/search?q=banane')
    expect(res.body.results.filter((r: Result) => r.source === 'yazio')).toEqual([])
  })

  it('senza un giro riuscito o con la sincronizzazione spenta YAZIO non si interroga', async () => {
    const { api, fake } = setup()
    await api.get('/foods/search?q=grissini')
    expect(fake.state.calls).toEqual([])
    await api.post('/yazio/sync')
    await api.put('/yazio/sync', { enabled: false })
    fake.state.calls = []
    await api.get('/foods/search?q=grissini')
    expect(fake.state.calls).toEqual([])
  })

  it('YAZIO che non risponde finisce fra le fonti non disponibili', async () => {
    const { api, fake } = setup()
    await api.post('/yazio/sync')
    fake.state.online = false
    const res = await api.get('/foods/search?q=grissini')
    expect(res.body.unavailable).toContain('yazio')
    expect(res.body.results.length).toBeGreaterThan(0)
  })

  it('un alimento registrato da YAZIO conserva il product_id', async () => {
    const { api } = setup()
    await api.post('/yazio/sync')
    const found = (await api.get('/foods/search?q=mela')).body.results.find(
      (r: Result) => r.source === 'yazio',
    )
    const day = await api.post('/meals', {
      date: '2026-10-22',
      slot: 'breakfast',
      items: [{ food: found, grams: 150 }],
    })
    expect(day.status).toBe(201)
    const { rows } = await db.query<{ yazio_product_id: string; source: string }>(
      'select yazio_product_id, source from foods',
    )
    expect(rows).toEqual([{ yazio_product_id: 'p-mela', source: 'yazio' }])
  })
})

describe('fromYazioProduct', () => {
  it('porta i nutrienti da per 1 g a per 100 g', () => {
    expect(
      fromYazioProduct({
        product_id: 'x',
        name: ' Pane ',
        producer: '',
        nutrients: {
          'energy.energy': 2.654,
          'nutrient.protein': 0.09,
          'nutrient.carb': 0.5,
          'nutrient.fat': 0.032,
        },
      }),
    ).toMatchObject({ name: 'Pane', brand: null, kcal: 265.4, protein: 9, carbs: 50, fat: 3.2 })
  })
})

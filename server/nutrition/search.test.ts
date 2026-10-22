// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { testDb } from '../testing/db.ts'
import { createFakeFoods, FAKE_FOODS_CONFIG } from '../testing/fake-foods.ts'
import { nutritionApp, resetNutrition, seedFood } from '../testing/nutrition.ts'
import { ensureFood } from './foods.ts'
import { createExternalSearch, fromOff, fromUsda } from './foodsearch.ts'

let db: Awaited<ReturnType<typeof testDb>>
beforeAll(async () => {
  db = await testDb()
})
afterAll(() => db.drop())
beforeEach(() => resetNutrition(db))

function setup() {
  const fake = createFakeFoods()
  const external = createExternalSearch(FAKE_FOODS_CONFIG(), { fetch: fake.fetch as typeof fetch })
  return { fake, external, api: nutritionApp(db, { external }) }
}

type Result = { name: string; source: string; id: string | null; brand: string | null }

describe('ricerca alimenti (NUT-004)', () => {
  it('meno di 2 caratteri: nessun risultato e nessuna chiamata', async () => {
    const { api, fake } = setup()
    expect((await api.get('/foods/search?q=y')).body).toEqual({ results: [], unavailable: [] })
    expect(fake.state.calls).toEqual([])
  })

  it('unisce catalogo locale, OpenFoodFacts e USDA, in quest’ordine', async () => {
    const { api } = setup()
    await seedFood(db, { name: 'Yogurt greco 0%', kcal: 58, protein: 10 })
    const res = await api.get('/foods/search?q=yogurt%20greco')
    const results: Result[] = res.body.results
    expect(results.map((r) => [r.source, r.name])).toEqual([
      ['custom', 'Yogurt greco 0%'],
      ['openfoodfacts', 'Yogurt greco bianco 2%'],
      ['openfoodfacts', 'Yogurt greco colato 5%'],
      ['usda', 'Yogurt, greek, plain, nonfat'],
    ])
    expect(results[0].id).toEqual(expect.any(String))
    expect(results[1]).toMatchObject({ id: null, brand: 'Fage', barcode: '5201054017111', kcal: 73 })
  })

  it('Solo Italia di default; italy=0 cerca nel mondo', async () => {
    const { api, fake } = setup()
    const it = await api.get('/foods/search?q=joghurt')
    expect(it.body.results).toEqual([])
    expect(fake.state.calls[0]).toBe('/off-it joghurt')
    const world = await api.get('/foods/search?q=joghurt&italy=0')
    expect(world.body.results.map((r: Result) => r.name)).toEqual(['Griechischer Joghurt'])
  })

  it('niente doppioni per nome e marca, né per id esterno già nel catalogo', async () => {
    const { api, external } = setup()
    const [off] = (await external.off('fage', { limit: 5, italy: true })) ?? []
    await ensureFood(db, off)
    const results: Result[] = (await api.get('/foods/search?q=yogurt%20greco%20bianco')).body.results
    expect(results.filter((r) => r.name === 'Yogurt greco bianco 2%')).toHaveLength(1)
    expect(results[0].id).toEqual(expect.any(String))
  })

  it('una fonte giù non ferma la ricerca e viene segnalata', async () => {
    const { api, fake } = setup()
    fake.state.usda = false
    const res = await api.get('/foods/search?q=yogurt')
    expect(res.status).toBe(200)
    expect(res.body.unavailable).toEqual(['usda'])
    expect(res.body.results.length).toBeGreaterThan(0)
  })

  it('senza fonti esterne cerca solo nel catalogo', async () => {
    await seedFood(db, { name: 'Mela', kcal: 52 })
    const res = await nutritionApp(db).get('/foods/search?q=mel')
    expect(res.body.results.map((r: Result) => r.name)).toEqual(['Mela'])
  })
})

describe('catalogo', () => {
  it('ensureFood: un candidato entra una volta sola', async () => {
    const { external } = setup()
    const [off] = (await external.off('grissini', { limit: 5, italy: true })) ?? []
    const a = await ensureFood(db, off)
    const b = await ensureFood(db, off)
    expect(a.id).toBe(b.id)
    const { rows } = await db.query('select count(*)::int as n from foods')
    expect(rows[0]).toEqual({ n: 1 })
  })

  it('la ricerca locale trova per parole del nome o della marca', async () => {
    await seedFood(db, { name: 'Pane integrale', kcal: 240, brand: 'Forno Rossi' })
    await seedFood(db, { name: 'Panettone', kcal: 380 })
    const { api } = setup()
    const byBrand = (await api.get('/foods/search?q=rossi')).body.results as Result[]
    expect(byBrand[0].name).toBe('Pane integrale')
    const both = (await api.get('/foods/search?q=pane')).body.results as Result[]
    // Prima chi inizia con la ricerca, poi il nome più corto.
    expect(both.slice(0, 2).map((r) => r.name)).toEqual(['Panettone', 'Pane integrale'])
  })
})

describe('conversioni', () => {
  it('OpenFoodFacts: kJ in kcal, caffeina in mg, senza kcal scartato', () => {
    expect(
      fromOff({ code: '1', product_name: 'X', nutriments: { energy_100g: 418.4, caffeine_100g: 0.04 } }),
    ).toMatchObject({ kcal: 100, caffeineMg: 40 })
    expect(fromOff({ code: '1', product_name: 'X', nutriments: {} })).toBeNull()
    expect(fromOff({ code: '1', product_name: '', nutriments: { 'energy-kcal_100g': 1 } })).toBeNull()
  })

  it('USDA: preferisce le kcal ai kJ e mette il nome in minuscolo', () => {
    expect(
      fromUsda({
        fdcId: 1,
        description: 'APPLES, RAW',
        foodNutrients: [
          { nutrientName: 'Energy', unitName: 'KJ', value: 218 },
          { nutrientName: 'Energy', unitName: 'KCAL', value: 52 },
        ],
      }),
    ).toMatchObject({ name: 'Apples, raw', kcal: 52, externalId: '1' })
  })
})

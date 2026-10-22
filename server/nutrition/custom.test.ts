// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { testDb } from '../testing/db.ts'
import { nutritionApp, resetNutrition, seedFood } from '../testing/nutrition.ts'

let db: Awaited<ReturnType<typeof testDb>>
beforeAll(async () => {
  db = await testDb()
})
afterAll(() => db.drop())
beforeEach(() => resetNutrition(db))

const now = () => new Date('2026-10-21T10:30:00Z')
const granola = { name: 'Granola della casa', kcal: 450, protein: 10, carbs: 60, fat: 18 }

describe('alimenti personali (NUT-006)', () => {
  it('si creano con i soli campi obbligatori e si elencano per nome', async () => {
    const api = nutritionApp(db, { now })
    const res = await api.post('/foods', granola)
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({
      ...granola,
      id: expect.any(String),
      source: 'custom',
      brand: null,
      barcode: null,
      servingSizeG: null,
      caffeineMg: null,
    })
    await api.post('/foods', {
      ...granola,
      name: 'Barretta',
      brand: 'Forno Rossi',
      barcode: '80012345',
      servingSizeG: 30,
    })
    await seedFood(db, { name: 'Yogurt', kcal: 60, source: 'openfoodfacts' })
    const list = await api.get('/foods')
    expect(list.body.foods.map((f: { name: string }) => f.name)).toEqual(['Barretta', 'Granola della casa'])
  })

  it('i campi facoltativi vuoti valgono null; quelli obbligatori no', async () => {
    const api = nutritionApp(db, { now })
    const ok = await api.post('/foods', { ...granola, brand: ' ', barcode: '' })
    expect(ok.body).toMatchObject({ brand: null, barcode: null })
    for (const bad of [
      { ...granola, name: '' },
      { ...granola, kcal: -1 },
      { ...granola, protein: 120 },
      { ...granola, barcode: 'abc' },
      { name: 'Solo nome', kcal: 100 },
    ]) {
      expect((await api.post('/foods', bad)).status).toBe(400)
    }
  })

  it('un codice a barre già usato è un 409', async () => {
    const api = nutritionApp(db, { now })
    await seedFood(db, { name: 'Fage', kcal: 73, barcode: '5201054017111', source: 'openfoodfacts' })
    const res = await api.post('/foods', { ...granola, barcode: '5201054017111' })
    expect(res.status).toBe(409)
    expect(res.body.error).toBe('barcode_exists')
  })

  it('si modificano, e i pasti già registrati non cambiano', async () => {
    const api = nutritionApp(db, { now })
    const { body: food } = await api.post('/foods', { ...granola, brand: 'Forno Rossi' })
    await api.post('/meals', {
      date: '2026-10-21',
      slot: 'breakfast',
      items: [{ foodId: food.id, grams: 50 }],
    })

    const res = await api.patch(`/foods/${food.id}`, { kcal: 400, name: 'Granola leggera' })
    expect(res.status).toBe(200)
    // Solo i campi mandati cambiano.
    expect(res.body).toMatchObject({ name: 'Granola leggera', kcal: 400, brand: 'Forno Rossi', protein: 10 })

    const day = await api.get('/day?date=2026-10-21')
    const breakfast = day.body.slots.find((s: { slot: string }) => s.slot === 'breakfast')
    expect(breakfast.meal.items[0]).toMatchObject({ name: 'Granola della casa (Forno Rossi)', kcal: 225 })
  })

  it('si eliminano: il pasto resta, senza collegamento', async () => {
    const api = nutritionApp(db, { now })
    const { body: food } = await api.post('/foods', granola)
    await api.post('/meals', { date: '2026-10-21', slot: 'lunch', items: [{ foodId: food.id, grams: 100 }] })
    expect((await api.delete(`/foods/${food.id}`)).status).toBe(204)
    expect((await api.get('/foods')).body.foods).toEqual([])
    const day = await api.get('/day?date=2026-10-21')
    const lunch = day.body.slots.find((s: { slot: string }) => s.slot === 'lunch')
    expect(lunch.meal.items[0]).toMatchObject({ foodId: null, name: 'Granola della casa', kcal: 450 })
  })

  it('gli alimenti di altre fonti non si toccano; id sconosciuto 404', async () => {
    const api = nutritionApp(db, { now })
    const off = await seedFood(db, { name: 'Yogurt', kcal: 60, source: 'openfoodfacts' })
    expect((await api.patch(`/foods/${off}`, { kcal: 1 })).body.error).toBe('food_not_custom')
    expect((await api.delete(`/foods/${off}`)).status).toBe(409)
    const missing = '00000000-0000-4000-8000-000000000000'
    expect((await api.patch(`/foods/${missing}`, { kcal: 1 })).status).toBe(404)
    expect((await api.delete('/foods/non-un-id')).status).toBe(400)
    const { body: food } = await api.post('/foods', granola)
    expect((await api.patch(`/foods/${food.id}`, { source: 'usda' })).status).toBe(400)
  })

  it('la ricerca li trova come propri', async () => {
    const api = nutritionApp(db, { now })
    await api.post('/foods', granola)
    const res = await api.get('/foods/search?q=granola')
    expect(res.body.results[0]).toMatchObject({ name: 'Granola della casa', source: 'custom' })
  })
})

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

async function foods() {
  return {
    riso: await seedFood(db, { name: 'Riso basmati', kcal: 350, protein: 7, carbs: 78, fat: 0.6 }),
    pollo: await seedFood(db, { name: 'Petto di pollo', kcal: 110, protein: 23, carbs: 0, fat: 1.2 }),
    zucchine: await seedFood(db, { name: 'Zucchine', kcal: 17, protein: 1.2, carbs: 3.1, fat: 0.3 }),
  }
}

describe('ricette (NUT-008)', () => {
  it('si crea con nome, note e alimenti; mostra kcal e macro totali', async () => {
    const f = await foods()
    const api = nutritionApp(db, { now })
    const res = await api.post('/recipes', {
      name: 'Riso, pollo e zucchine',
      notes: "Zucchine in padella con un filo d'olio.",
      items: [
        { foodId: f.riso, grams: 80 },
        { foodId: f.pollo, grams: 150 },
        { foodId: f.zucchine, grams: 200 },
      ],
    })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({
      name: 'Riso, pollo e zucchine',
      notes: "Zucchine in padella con un filo d'olio.",
      kcal: 479,
      protein: 42.5,
      grams: 430,
    })
    expect(res.body.items.map((i: { name: string; kcal: number }) => [i.name, i.kcal])).toEqual([
      ['Riso basmati', 280],
      ['Petto di pollo', 165],
      ['Zucchine', 34],
    ])
    const list = await api.get('/recipes')
    expect(list.body.recipes.map((r: { name: string }) => r.name)).toEqual(['Riso, pollo e zucchine'])
  })

  it('un risultato esterno entra nel catalogo; note vuote valgono null', async () => {
    const api = nutritionApp(db, { now })
    const res = await api.post('/recipes', {
      name: 'Yogurt',
      notes: '',
      items: [
        {
          food: {
            source: 'usda',
            externalId: '1',
            name: 'Yogurt, greek',
            kcal: 59,
            protein: 10,
            carbs: 3.6,
            fat: 0.4,
          },
          grams: 170,
        },
      ],
    })
    expect(res.body).toMatchObject({ notes: null, kcal: 100 })
    expect(res.body.items[0].foodId).toEqual(expect.any(String))
  })

  it('si modifica sostituendo gli alimenti, e si elimina', async () => {
    const f = await foods()
    const api = nutritionApp(db, { now })
    const { body } = await api.post('/recipes', { name: 'Pranzo', items: [{ foodId: f.riso, grams: 80 }] })
    const put = await api.put(`/recipes/${body.id}`, {
      name: 'Pranzo leggero',
      items: [{ foodId: f.zucchine, grams: 300 }],
    })
    expect(put.body).toMatchObject({ name: 'Pranzo leggero', kcal: 51 })
    expect(put.body.items).toHaveLength(1)
    expect((await api.delete(`/recipes/${body.id}`)).status).toBe(204)
    expect((await api.get(`/recipes/${body.id}`)).status).toBe(404)
  })

  it('un alimento eliminato resta nella ricetta ma non conta', async () => {
    const f = await foods()
    const api = nutritionApp(db, { now })
    const { body } = await api.post('/recipes', {
      name: 'Pranzo',
      items: [
        { foodId: f.riso, grams: 80 },
        { foodId: f.pollo, grams: 150 },
      ],
    })
    await db.query('delete from foods where id = $1', [f.pollo])
    const res = await api.get(`/recipes/${body.id}`)
    expect(res.body.kcal).toBe(280)
    expect(res.body.items[1]).toMatchObject({ name: 'Petto di pollo', foodId: null, missing: true, kcal: 0 })
  })

  it('si registra in un colpo, anche per più porzioni', async () => {
    const f = await foods()
    const api = nutritionApp(db, { now })
    const { body: recipe } = await api.post('/recipes', {
      name: 'Pranzo',
      items: [
        { foodId: f.riso, grams: 80 },
        { foodId: f.pollo, grams: 150 },
      ],
    })
    const res = await api.post('/meals', {
      date: '2026-10-21',
      slot: 'lunch',
      items: [{ recipeId: recipe.id, factor: 1.5 }],
    })
    expect(res.status).toBe(201)
    const lunch = res.body.slots.find((s: { slot: string }) => s.slot === 'lunch')
    expect(lunch.meal.items.map((i: { name: string; grams: number }) => [i.name, i.grams])).toEqual([
      ['Riso basmati', 120],
      ['Petto di pollo', 225],
    ])
  })

  it('richieste non valide: 400; ricetta sconosciuta: 404', async () => {
    const api = nutritionApp(db, { now })
    expect((await api.post('/recipes', { name: 'Vuota', items: [] })).status).toBe(400)
    expect(
      (await api.post('/recipes', { name: ' ', items: [{ foodId: crypto.randomUUID(), grams: 1 }] })).status,
    ).toBe(400)
    const missing = '00000000-0000-4000-8000-000000000000'
    expect((await api.post('/recipes', { name: 'X', items: [{ foodId: missing, grams: 10 }] })).status).toBe(
      404,
    )
    expect(
      (await api.put(`/recipes/${missing}`, { name: 'X', items: [{ foodId: missing, grams: 10 }] })).status,
    ).toBe(404)
    expect((await api.delete(`/recipes/${missing}`)).status).toBe(404)
    expect(
      (await api.post('/meals', { date: '2026-10-21', slot: 'lunch', items: [{ recipeId: missing }] }))
        .status,
    ).toBe(404)
  })
})

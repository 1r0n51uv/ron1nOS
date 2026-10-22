// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { testDb } from '../testing/db.ts'
import { nutritionApp, resetNutrition, seedFood, seedMeal } from '../testing/nutrition.ts'

let db: Awaited<ReturnType<typeof testDb>>
beforeAll(async () => {
  db = await testDb()
})
afterAll(() => db.drop())
beforeEach(() => resetNutrition(db))

const now = () => new Date('2026-10-21T10:30:00Z')

async function setup() {
  const api = nutritionApp(db, { now })
  const riso = await seedFood(db, { name: 'Riso basmati', kcal: 350 })
  const pollo = await seedFood(db, { name: 'Petto di pollo', kcal: 110 })
  const mela = await seedFood(db, { name: 'Mela', kcal: 52 })
  const { body: recipe } = await api.post('/recipes', {
    name: 'Riso e pollo',
    items: [
      { foodId: riso, grams: 80 },
      { foodId: pollo, grams: 150 },
    ],
  })
  return { api, mela, recipe }
}

describe('template settimanali (NUT-010)', () => {
  it('griglia con ricette o alimenti e kcal per giorno', async () => {
    const { api, mela, recipe } = await setup()
    const res = await api.post('/templates', {
      name: 'Definizione',
      cells: [
        { weekday: 1, slot: 'lunch', recipeId: recipe.id },
        { weekday: 1, slot: 'morning_snack', foodId: mela, grams: 180 },
        { weekday: 3, slot: 'dinner', recipeId: recipe.id },
      ],
    })
    expect(res.status).toBe(201)
    expect(
      res.body.cells.map((c: { weekday: number; slot: string; name: string; kcal: number }) => [
        c.weekday,
        c.slot,
        c.name,
        c.kcal,
      ]),
    ).toEqual([
      [1, 'morning_snack', 'Mela', 94],
      [1, 'lunch', 'Riso e pollo', 445],
      [3, 'dinner', 'Riso e pollo', 445],
    ])
    expect(res.body.dayKcal).toEqual([539, 0, 445, 0, 0, 0, 0])
    expect((await api.get('/templates')).body.templates.map((t: { name: string }) => t.name)).toEqual([
      'Definizione',
    ])
  })

  it('mai ricetta e alimento insieme, una voce per cella', async () => {
    const { api, mela, recipe } = await setup()
    const both = { weekday: 1, slot: 'lunch', recipeId: recipe.id, foodId: mela, grams: 100 }
    expect((await api.post('/templates', { name: 'X', cells: [both] })).status).toBe(400)
    const twice = [
      { weekday: 1, slot: 'lunch', recipeId: recipe.id },
      { weekday: 1, slot: 'lunch', foodId: mela, grams: 100 },
    ]
    expect((await api.post('/templates', { name: 'X', cells: twice })).status).toBe(400)
    expect(
      (
        await api.post('/templates', {
          name: 'X',
          cells: [{ weekday: 8, slot: 'lunch', recipeId: recipe.id }],
        })
      ).status,
    ).toBe(400)
    const missing = '00000000-0000-4000-8000-000000000000'
    expect(
      (await api.post('/templates', { name: 'X', cells: [{ weekday: 1, slot: 'lunch', recipeId: missing }] }))
        .status,
    ).toBe(404)
    const { rows } = await db.query('select count(*)::int as n from diet_templates')
    expect(rows[0]).toEqual({ n: 0 })
  })

  it('si modifica sostituendo la griglia, e si elimina', async () => {
    const { api, mela, recipe } = await setup()
    const { body } = await api.post('/templates', {
      name: 'Massa',
      cells: [{ weekday: 2, slot: 'lunch', recipeId: recipe.id }],
    })
    const put = await api.put(`/templates/${body.id}`, {
      name: 'Massa invernale',
      cells: [{ weekday: 5, slot: 'breakfast', foodId: mela, grams: 100 }],
    })
    expect(put.body).toMatchObject({ name: 'Massa invernale', dayKcal: [0, 0, 0, 0, 52, 0, 0] })
    expect((await api.delete(`/templates/${body.id}`)).status).toBe(204)
    expect((await api.delete(`/templates/${body.id}`)).status).toBe(404)
  })

  it('applicato a una settimana sostituisce solo i pasti ancora pianificati', async () => {
    const { api, mela, recipe } = await setup()
    const { body: t } = await api.post('/templates', {
      name: 'Definizione',
      cells: [
        { weekday: 1, slot: 'lunch', recipeId: recipe.id },
        { weekday: 2, slot: 'lunch', recipeId: recipe.id },
        { weekday: 3, slot: 'lunch', recipeId: recipe.id },
        { weekday: 4, slot: 'lunch', recipeId: recipe.id },
      ],
    })
    // Lunedì 26: già pianificato a mano; martedì 27: mangiato; mercoledì 28: saltato.
    await api.put('/plans', { date: '2026-10-26', slot: 'lunch', items: [{ foodId: mela, grams: 100 }] })
    const eaten = await api.put('/plans', {
      date: '2026-10-27',
      slot: 'lunch',
      items: [{ foodId: mela, grams: 100 }],
    })
    const eatenId = eaten.body.slots.find((s: { slot: string }) => s.slot === 'lunch').planned.id
    await api.put(`/plans/${eatenId}/status`, { status: 'eaten' })
    const skipped = await api.put('/plans', {
      date: '2026-10-28',
      slot: 'lunch',
      items: [{ foodId: mela, grams: 100 }],
    })
    const skippedId = skipped.body.slots.find((s: { slot: string }) => s.slot === 'lunch').planned.id
    await api.put(`/plans/${skippedId}/status`, { status: 'skipped' })

    const res = await api.post(`/templates/${t.id}/apply`, { monday: '2026-10-26' })
    expect(res.body).toEqual({ created: 1, replaced: 1, kept: 2 })

    const day = async (d: string) =>
      (await api.get(`/day?date=${d}`)).body.slots.find((s: { slot: string }) => s.slot === 'lunch')
    expect((await day('2026-10-26')).planned).toMatchObject({
      recipeName: 'Riso e pollo',
      templateName: 'Definizione',
    })
    expect((await day('2026-10-27')).planned).toMatchObject({ status: 'eaten', templateName: null })
    expect((await day('2026-10-28')).state).toBe('skipped')
    expect((await day('2026-10-29')).planned).toMatchObject({
      status: 'planned',
      templateName: 'Definizione',
      kcal: 445,
    })
  })

  it('un pasto registrato a mano non blocca il piano del template', async () => {
    const { api, recipe } = await setup()
    await seedMeal(db, '2026-10-26', 'lunch', [{ name: 'Pizza', grams: 300, kcal: 800 }])
    const { body: t } = await api.post('/templates', {
      name: 'T',
      cells: [{ weekday: 1, slot: 'lunch', recipeId: recipe.id }],
    })
    expect((await api.post(`/templates/${t.id}/apply`, { monday: '2026-10-26' })).body).toEqual({
      created: 1,
      replaced: 0,
      kept: 0,
    })
  })

  it('la settimana parte da lunedì', async () => {
    const { api, recipe } = await setup()
    const { body: t } = await api.post('/templates', {
      name: 'T',
      cells: [{ weekday: 1, slot: 'lunch', recipeId: recipe.id }],
    })
    expect((await api.post(`/templates/${t.id}/apply`, { monday: '2026-10-27' })).status).toBe(400)
    const missing = '00000000-0000-4000-8000-000000000000'
    expect((await api.post(`/templates/${missing}/apply`, { monday: '2026-10-26' })).status).toBe(404)
  })
})

describe('template con alimenti esterni', () => {
  it('un risultato della ricerca entra nel catalogo', async () => {
    const api = nutritionApp(db, { now })
    const food = {
      source: 'usda',
      externalId: '9',
      name: 'Apples, raw',
      kcal: 52,
      protein: 0.3,
      carbs: 14,
      fat: 0.2,
    }
    const res = await api.post('/templates', {
      name: 'T',
      cells: [{ weekday: 2, slot: 'afternoon_snack', food, grams: 200 }],
    })
    expect(res.body.cells[0]).toMatchObject({ name: 'Apples, raw', kcal: 104, foodId: expect.any(String) })
  })
})

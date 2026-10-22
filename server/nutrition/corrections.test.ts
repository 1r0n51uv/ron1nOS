// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { testDb } from '../testing/db.ts'
import { nutritionApp, resetNutrition, seedFood, seedMeal, seedPlanned } from '../testing/nutrition.ts'

let db: Awaited<ReturnType<typeof testDb>>
beforeAll(async () => {
  db = await testDb()
})
afterAll(() => db.drop())
beforeEach(() => resetNutrition(db))

const now = () => new Date('2026-10-21T10:30:00Z')
type Item = { id: string; name: string; grams: number; kcal: number; protein: number }
type Slot = { slot: string; state: string; meal: { kcal: number; items: Item[] } | null }
const slot = (body: { slots: Slot[] }, id: string) => body.slots.find((s) => s.slot === id)!

describe('correggere un pasto (NUT-007)', () => {
  it('toglie una riga e ricalcola i totali', async () => {
    const { itemIds } = await seedMeal(db, '2026-10-20', 'breakfast', [
      { name: 'Yogurt', grams: 170, kcal: 99, protein: 17 },
      { name: 'Avena', grams: 50, kcal: 186, protein: 6.5 },
    ])
    const res = await nutritionApp(db, { now }).delete(`/meals/items/${itemIds[0]}`)
    expect(res.status).toBe(200)
    expect(res.body.date).toBe('2026-10-20')
    expect(slot(res.body, 'breakfast').meal?.items.map((i) => i.name)).toEqual(['Avena'])
    expect(res.body.totals.kcal).toBe(186)
  })

  it('togliendo l’ultima riga il pasto sparisce e il piano torna saltato', async () => {
    const pollo = await seedFood(db, { name: 'Pollo', kcal: 110 })
    const { mealId, itemIds } = await seedMeal(db, '2026-10-21', 'lunch', [
      { name: 'Pollo', grams: 150, kcal: 165 },
    ])
    const plan = await seedPlanned(
      db,
      '2026-10-21',
      'lunch',
      [{ foodId: pollo, name: 'Pollo', grams: 150 }],
      'eaten',
    )
    await db.query('update planned_meals set meal_entry_id = $1 where id = $2', [mealId, plan])

    const res = await nutritionApp(db, { now }).delete(`/meals/items/${itemIds[0]}`)
    expect(slot(res.body, 'lunch')).toMatchObject({ state: 'skipped', meal: null })
    const { rows } = await db.query('select count(*)::int as n from meal_entries')
    expect(rows[0]).toEqual({ n: 0 })
    const planned = await db.query('select status, meal_entry_id from planned_meals')
    expect(planned.rows[0]).toEqual({ status: 'skipped', meal_entry_id: null })
  })

  it('senza piano, togliere l’ultima riga lascia lo slot vuoto', async () => {
    const { itemIds } = await seedMeal(db, '2026-10-21', 'dinner', [{ name: 'Pizza', grams: 300, kcal: 800 }])
    const res = await nutritionApp(db, { now }).delete(`/meals/items/${itemIds[0]}`)
    expect(slot(res.body, 'dinner').state).toBe('empty')
  })

  it('cambia i grammi scalando i valori copiati', async () => {
    const pane = await seedFood(db, { name: 'Pane', kcal: 250, protein: 8, caffeine: 0 })
    const api = nutritionApp(db, { now })
    const logged = await api.post('/meals', {
      date: '2026-10-19',
      slot: 'lunch',
      items: [{ foodId: pane, grams: 100 }],
    })
    const id = slot(logged.body, 'lunch').meal!.items[0].id
    // L'alimento cambia dopo: la correzione parte dalla riga, non da lì.
    await db.query('update foods set calories_per_100g = 999 where id = $1', [pane])
    const res = await api.patch(`/meals/items/${id}`, { grams: 60 })
    expect(res.status).toBe(200)
    expect(slot(res.body, 'lunch').meal?.items[0]).toMatchObject({ grams: 60, kcal: 150, protein: 4.8 })
  })

  it('un extra si aggiunge a un pasto già mangiato di un giorno passato', async () => {
    await seedMeal(db, '2026-10-18', 'dinner', [{ name: 'Salmone', grams: 150, kcal: 312 }])
    const mela = await seedFood(db, { name: 'Mela', kcal: 52 })
    const res = await nutritionApp(db, { now }).post('/meals', {
      date: '2026-10-18',
      slot: 'dinner',
      items: [{ foodId: mela, grams: 100 }],
    })
    expect(slot(res.body, 'dinner').meal?.items.map((i) => i.name)).toEqual(['Salmone', 'Mela'])
  })

  it('righe sconosciute 404, grammi non validi 400', async () => {
    const api = nutritionApp(db, { now })
    const missing = '00000000-0000-4000-8000-000000000000'
    expect((await api.delete(`/meals/items/${missing}`)).status).toBe(404)
    expect((await api.patch(`/meals/items/${missing}`, { grams: 10 })).status).toBe(404)
    const { itemIds } = await seedMeal(db, '2026-10-21', 'dinner', [{ name: 'Pizza', grams: 300, kcal: 800 }])
    for (const grams of [0, -5, 20_000, 'tanti']) {
      expect((await api.patch(`/meals/items/${itemIds[0]}`, { grams })).status).toBe(400)
    }
    expect((await api.delete('/meals/items/x')).status).toBe(400)
  })
})

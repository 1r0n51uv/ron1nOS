// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { testDb } from '../testing/db.ts'
import { nutritionApp, resetNutrition, seedFood, seedMeal, seedPlanned } from '../testing/nutrition.ts'
import { addGoal } from './goals.ts'

let db: Awaited<ReturnType<typeof testDb>>
beforeAll(async () => {
  db = await testDb()
})
afterAll(() => db.drop())
beforeEach(() => resetNutrition(db))

const now = () => new Date('2026-10-21T10:00:00Z')

describe('GET /day (NUT-002)', () => {
  it('un giorno vuoto ha i 5 slot vuoti e totali a zero', async () => {
    const res = await nutritionApp(db, { now }).get('/day')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      date: '2026-10-21',
      goal: null,
      totals: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
      plannedKcal: 0,
    })
    expect(res.body.slots.map((s: { slot: string; state: string }) => [s.slot, s.state])).toEqual([
      ['breakfast', 'empty'],
      ['morning_snack', 'empty'],
      ['lunch', 'empty'],
      ['afternoon_snack', 'empty'],
      ['dinner', 'empty'],
    ])
  })

  it('mangiato, pianificato e saltato, con i totali del giorno scelto', async () => {
    await addGoal(db, {
      source: 'manual',
      kcal: 2021,
      protein: 126,
      carbs: 227,
      fat: 67,
      waterMl: 2500,
      effectiveFrom: '2026-10-01',
    })
    const riso = await seedFood(db, { name: 'Riso basmati', kcal: 350, protein: 7, carbs: 78, fat: 0.6 })
    const pollo = await seedFood(db, { name: 'Petto di pollo', kcal: 110, protein: 23, carbs: 0, fat: 1.2 })
    await seedMeal(db, '2026-10-21', 'breakfast', [
      { name: 'Yogurt greco 0%', grams: 170, kcal: 99, protein: 17, carbs: 6.6, fat: 0 },
      { name: "Fiocchi d'avena", grams: 50, kcal: 186, protein: 6.5, carbs: 30, fat: 3.5 },
    ])
    await seedPlanned(db, '2026-10-21', 'lunch', [
      { foodId: riso, name: 'Riso basmati', grams: 80 },
      { foodId: pollo, name: 'Petto di pollo', grams: 150 },
    ])
    await seedPlanned(db, '2026-10-21', 'dinner', [], 'skipped')
    // Un altro giorno non entra nei totali.
    await seedMeal(db, '2026-10-20', 'breakfast', [{ name: 'Mela', grams: 180, kcal: 94 }])

    const res = await nutritionApp(db, { now }).get('/day?date=2026-10-21')
    expect(res.body.goal).toEqual({ kcal: 2021, protein: 126, carbs: 227, fat: 67, waterMl: 2500 })
    expect(res.body.totals).toEqual({ kcal: 285, protein: 23.5, carbs: 36.6, fat: 3.5 })
    const [breakfast, , lunch, snack, dinner] = res.body.slots
    expect(breakfast.state).toBe('eaten')
    expect(breakfast.meal.items.map((i: { name: string }) => i.name)).toEqual([
      'Yogurt greco 0%',
      "Fiocchi d'avena",
    ])
    expect(breakfast.meal.items[0]).toMatchObject({ grams: 170, kcal: 99, origin: 'ron1nos', sync: 'local' })
    expect(lunch.state).toBe('planned')
    // 280 + 165 kcal dai valori per 100 g.
    expect(lunch.planned).toMatchObject({ kcal: 445, status: 'planned' })
    expect(lunch.planned.items[1]).toMatchObject({
      name: 'Petto di pollo',
      grams: 150,
      kcal: 165,
      protein: 34.5,
    })
    expect(snack.state).toBe('empty')
    expect(dinner.state).toBe('skipped')
    expect(res.body.plannedKcal).toBe(445)
  })

  it('una data non valida dà 400', async () => {
    expect((await nutritionApp(db, { now }).get('/day?date=domani')).status).toBe(400)
  })
})

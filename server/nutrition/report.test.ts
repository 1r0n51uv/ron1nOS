// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { testDb } from '../testing/db.ts'
import { nutritionApp, resetNutrition, seedMeal } from '../testing/nutrition.ts'
import { addDays } from './dates.ts'

let db: Awaited<ReturnType<typeof testDb>>
beforeAll(async () => {
  db = await testDb()
})
afterAll(() => db.drop())
beforeEach(() => resetNutrition(db))

const TODAY = '2026-10-22'
const now = () => new Date(`${TODAY}T10:00:00Z`)

async function goal(kcal: number, from: string) {
  await db.query(
    `insert into nutrition_goals (source, calories_target, protein_g_target, carbs_g_target, fat_g_target,
       effective_from) values ('manual', $1, 120, 220, 65, $2)`,
    [kcal, from],
  )
}

describe('andamento (NUT-017)', () => {
  it('serie di 30 giorni fino a oggi, i giorni vuoti a zero', async () => {
    const api = nutritionApp(db, { now })
    await seedMeal(db, TODAY, 'lunch', [
      { name: 'Riso', grams: 100, kcal: 360, protein: 7, carbs: 79, fat: 1 },
    ])
    const res = await api.get('/report')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ days: 30, from: '2026-09-23', to: TODAY })
    expect(res.body.series).toHaveLength(30)
    expect(res.body.series.at(-1)).toEqual({
      date: TODAY,
      kcal: 360,
      protein: 7,
      carbs: 79,
      fat: 1,
      logged: true,
      goalKcal: null,
    })
    expect(res.body.series[0]).toMatchObject({ kcal: 0, logged: false })
    expect((await api.get('/report?days=90')).body.series).toHaveLength(90)
    expect((await api.get('/report?days=7')).status).toBe(400)
  })

  it('media e macro solo sui giorni registrati', async () => {
    const api = nutritionApp(db, { now })
    await seedMeal(db, TODAY, 'lunch', [
      { name: 'A', grams: 100, kcal: 2000, protein: 100, carbs: 200, fat: 60 },
    ])
    await seedMeal(db, addDays(TODAY, -2), 'lunch', [
      { name: 'B', grams: 100, kcal: 1800, protein: 80, carbs: 180, fat: 50 },
    ])
    const r = (await api.get('/report')).body
    expect(r.averageKcal).toBe(1900)
    expect(r.macros).toEqual({ protein: 90, carbs: 190, fat: 55 })
    // Meno di 4 giorni: niente tendenza.
    expect(r.trendKcalPerWeek).toBeNull()
  })

  it('tendenza in kcal a settimana', async () => {
    const api = nutritionApp(db, { now })
    // +10 kcal al giorno per 10 giorni: +70 a settimana.
    for (let i = 0; i < 10; i++) {
      await seedMeal(db, addDays(TODAY, -9 + i), 'lunch', [{ name: 'X', grams: 100, kcal: 2000 + i * 10 }])
    }
    expect((await api.get('/report')).body.trendKcalPerWeek).toBe(70)
  })

  it('aderenza: giorni entro ±150 kcal dall’obiettivo di quel giorno', async () => {
    const api = nutritionApp(db, { now })
    await goal(2000, '2026-10-01')
    await goal(1800, '2026-10-21')
    await seedMeal(db, '2026-10-20', 'lunch', [{ name: 'X', grams: 100, kcal: 2140 }]) // dentro (2000)
    await seedMeal(db, '2026-10-21', 'lunch', [{ name: 'X', grams: 100, kcal: 2140 }]) // fuori (1800)
    await seedMeal(db, '2026-10-22', 'lunch', [{ name: 'X', grams: 100, kcal: 1700 }]) // dentro (1800)
    // Prima di un obiettivo il giorno non conta.
    await seedMeal(db, '2026-09-25', 'lunch', [{ name: 'X', grams: 100, kcal: 900 }])
    const r = (await api.get('/report')).body
    expect(r.adherence).toEqual({ inTarget: 2, total: 3, pct: 67 })
    expect(r.series.find((d: { date: string }) => d.date === '2026-10-20').goalKcal).toBe(2000)
    expect(r.goal).toEqual({ protein: 120, carbs: 220, fat: 65 })
  })

  it('l’obiettivo del giorno comprende l’attività (NUT-016)', async () => {
    const api = nutritionApp(db, { now })
    await goal(2000, '2026-10-01')
    await db.query(`insert into day_activity (day, active_kcal, counted) values ($1, 300, true)`, [TODAY])
    await seedMeal(db, TODAY, 'lunch', [{ name: 'X', grams: 100, kcal: 2250 }])
    const r = (await api.get('/report')).body
    expect(r.series.at(-1).goalKcal).toBe(2300)
    expect(r.adherence.inTarget).toBe(1)
  })

  it('peso sullo stesso asse, con la variazione', async () => {
    const api = nutritionApp(db, { now })
    for (const [day, kg] of [
      ['2026-08-01', 85],
      ['2026-10-01', 81.5],
      ['2026-10-20', 80.1],
    ] as const) {
      await db.query(`insert into body_weights (day, source, weight_kg) values ($1, 'yazio', $2)`, [day, kg])
    }
    const r = (await api.get('/report')).body
    expect(r.weight).toEqual({
      points: [
        { date: '2026-10-01', kg: 81.5 },
        { date: '2026-10-20', kg: 80.1 },
      ],
      first: 81.5,
      last: 80.1,
      delta: -1.4,
    })
  })

  it('senza dati niente medie', async () => {
    const r = (await nutritionApp(db, { now }).get('/report')).body
    expect(r).toMatchObject({
      averageKcal: null,
      trendKcalPerWeek: null,
      adherence: { inTarget: 0, total: 0, pct: null },
      macros: null,
      goal: null,
      weight: { points: [], first: null, last: null, delta: null },
    })
  })
})

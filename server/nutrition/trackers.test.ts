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

describe('acqua (NUT-012)', () => {
  it('+ aggiunge 250 ml di default e il giorno ne porta il totale', async () => {
    const api = nutritionApp(db, { now })
    expect((await api.get('/day?date=2026-10-21')).body.waterMl).toBe(0)
    const first = await api.post('/water', { date: '2026-10-21' })
    expect(first.status).toBe(201)
    expect(first.body.waterMl).toBe(250)
    const second = await api.post('/water', { date: '2026-10-21', ml: 500 })
    expect(second.body.waterMl).toBe(750)
    // Gli altri giorni non cambiano.
    expect((await api.get('/day?date=2026-10-20')).body.waterMl).toBe(0)
  })

  it('− annulla l’ultima voce del giorno, non una quantità fissa', async () => {
    const api = nutritionApp(db, { now })
    await api.post('/water', { date: '2026-10-20', ml: 300 })
    await api.post('/water', { date: '2026-10-21', ml: 250 })
    await api.post('/water', { date: '2026-10-21', ml: 500 })
    const res = await api.delete('/water/last?date=2026-10-21')
    expect(res.status).toBe(200)
    expect(res.body.waterMl).toBe(250)
    expect((await api.delete('/water/last?date=2026-10-21')).body.waterMl).toBe(0)
    // Senza voci non succede niente.
    expect((await api.delete('/water/last?date=2026-10-21')).body.waterMl).toBe(0)
    expect((await api.get('/day?date=2026-10-20')).body.waterMl).toBe(300)
  })

  it('richieste non valide: 400', async () => {
    const api = nutritionApp(db, { now })
    for (const body of [
      {},
      { date: '21/10/2026' },
      { date: '2026-10-21', ml: 0 },
      { date: '2026-10-21', ml: 9000 },
    ]) {
      expect((await api.post('/water', body)).status).toBe(400)
    }
    expect((await api.delete('/water/last')).status).toBe(400)
  })
})

describe('caffeina (NUT-013)', () => {
  it('+ aggiunge un espresso da 80 mg, − annulla l’ultima voce', async () => {
    const api = nutritionApp(db, { now })
    expect((await api.get('/day?date=2026-10-21')).body.caffeine).toEqual({ totalMg: 0, mealsMg: 0 })
    const first = await api.post('/caffeine', { date: '2026-10-21' })
    expect(first.status).toBe(201)
    expect(first.body.caffeine.totalMg).toBe(80)
    await api.post('/caffeine', { date: '2026-10-21', mg: 40, source: 'Tè nero' })
    const res = await api.delete('/caffeine/last?date=2026-10-21')
    expect(res.body.caffeine.totalMg).toBe(80)
    const { rows } = await db.query('select source_name from caffeine_logs')
    expect(rows).toEqual([{ source_name: 'Espresso' }])
  })

  it('gli alimenti con caffeina si sommano al totale; − non li tocca', async () => {
    const caffe = await seedFood(db, { name: 'Caffè espresso', kcal: 2, caffeine: 212 })
    const api = nutritionApp(db, { now })
    await api.post('/meals', { date: '2026-10-21', slot: 'breakfast', items: [{ foodId: caffe, grams: 30 }] })
    await api.post('/caffeine', { date: '2026-10-21' })
    expect((await api.get('/day?date=2026-10-21')).body.caffeine).toEqual({ totalMg: 144, mealsMg: 64 })
    await api.delete('/caffeine/last?date=2026-10-21')
    const after = await api.delete('/caffeine/last?date=2026-10-21')
    expect(after.body.caffeine).toEqual({ totalMg: 64, mealsMg: 64 })
  })

  it('richieste non valide: 400', async () => {
    const api = nutritionApp(db, { now })
    for (const body of [{}, { date: '2026-10-21', mg: -1 }, { date: '2026-10-21', source: ' ' }]) {
      expect((await api.post('/caffeine', body)).status).toBe(400)
    }
    expect((await api.delete('/caffeine/last?date=ieri')).status).toBe(400)
  })
})

// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { testDb } from '../testing/db.ts'
import { nutritionApp, resetNutrition } from '../testing/nutrition.ts'

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

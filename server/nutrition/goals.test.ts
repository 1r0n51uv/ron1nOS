// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createApp } from '../app.ts'
import { testDb } from '../testing/db.ts'
import { fakeQbt } from '../testing/fake-qbt.ts'
import { nutritionApp, resetNutrition } from '../testing/nutrition.ts'
import { addGoal, goalsBetween } from './goals.ts'

let db: Awaited<ReturnType<typeof testDb>>
beforeAll(async () => {
  db = await testDb()
})
afterAll(() => db.drop())
beforeEach(() => resetNutrition(db))

const now = () => new Date('2026-10-22T10:00:00Z')
const input = { kcal: 2021, protein: 126, carbs: 227, fat: 67, waterMl: 2500 }

describe('obiettivo nutrizionale (NUT-015)', () => {
  it('senza obiettivo risponde current null e modificabile', async () => {
    const res = await nutritionApp(db, { now }).get('/goals')
    expect(res).toEqual({ status: 200, body: { current: null, history: [], editable: true } })
  })

  it('si imposta a mano: kcal, macro e acqua, valido da oggi', async () => {
    const api = nutritionApp(db, { now })
    const created = await api.post('/goals', input)
    expect(created.status).toBe(201)
    expect(created.body).toMatchObject({ ...input, source: 'manual', effectiveFrom: '2026-10-22' })
    expect((await api.get('/goals')).body.current).toMatchObject(input)
  })

  it('ogni cambio aggiunge una riga: lo storico non si perde', async () => {
    const api = nutritionApp(db, { now })
    await api.post('/goals', { ...input, effectiveFrom: '2026-10-01' })
    await api.post('/goals', { ...input, kcal: 2200 })
    const res = await api.get('/goals')
    expect(res.body.current.kcal).toBe(2200)
    expect(res.body.history.map((g: { kcal: number }) => g.kcal)).toEqual([2200, 2021])
    // Il 10 ottobre valeva ancora il primo.
    expect((await api.get('/goals?date=2026-10-10')).body.current.kcal).toBe(2021)
    expect((await api.get('/goals?date=2026-09-30')).body.current).toBeNull()
  })

  it('a parità di data vale l’ultima inserita', async () => {
    const api = nutritionApp(db, { now })
    await api.post('/goals', input)
    await api.post('/goals', { ...input, kcal: 1900 })
    expect((await api.get('/goals')).body.current.kcal).toBe(1900)
  })

  it('valori fuori misura o mancanti danno 400 invalid_request', async () => {
    const api = nutritionApp(db, { now })
    for (const bad of [
      { ...input, kcal: 100 },
      { ...input, protein: -1 },
      { kcal: 2000 },
      { ...input, effectiveFrom: 'ieri' },
    ]) {
      const res = await api.post('/goals', bad)
      expect(res.status).toBe(400)
      expect(res.body.error).toBe('invalid_request')
    }
    expect((await api.get('/goals?date=2026-13-01')).status).toBe(400)
  })

  it('con YAZIO collegato non si modifica: 409 goals_from_yazio', async () => {
    const api = nutritionApp(db, { now, goalsFromYazio: async () => true })
    expect((await api.get('/goals')).body.editable).toBe(false)
    const res = await api.post('/goals', input)
    expect(res.status).toBe(409)
    expect(res.body.error).toBe('goals_from_yazio')
  })

  it('goalsBetween dà l’obiettivo valido in ogni giorno', async () => {
    await addGoal(db, { source: 'manual', ...input, effectiveFrom: '2026-10-02' })
    await addGoal(db, { source: 'yazio', ...input, kcal: 2100, effectiveFrom: '2026-10-04' })
    const map = await goalsBetween(db, '2026-10-01', '2026-10-05')
    expect([...map.keys()]).toEqual(['2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05'])
    expect(map.get('2026-10-03')?.kcal).toBe(2021)
    expect(map.get('2026-10-05')).toMatchObject({ kcal: 2100, source: 'yazio' })
  })
})

describe('database', () => {
  it('senza database il modulo risponde 503 database_unavailable', async () => {
    const res = await createApp({ qbt: fakeQbt() }).request('/api/v1/nutrition/goals')
    expect(res.status).toBe(503)
    expect(await res.json()).toMatchObject({ error: 'database_unavailable' })
  })
})

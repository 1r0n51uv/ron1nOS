// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { testDb } from '../testing/db.ts'
import { nutritionApp, resetNutrition, seedFood, seedPlanned } from '../testing/nutrition.ts'

let db: Awaited<ReturnType<typeof testDb>>
beforeAll(async () => {
  db = await testDb()
})
afterAll(() => db.drop())
beforeEach(() => resetNutrition(db))

const now = () => new Date('2026-10-21T10:30:00Z')
type Item = {
  id: string
  name: string
  grams: number | null
  text: string | null
  checked: boolean
  source: string
}

async function setup() {
  const pollo = await seedFood(db, { name: 'Petto di pollo', kcal: 110 })
  const riso = await seedFood(db, { name: 'Riso basmati', kcal: 350 })
  await seedPlanned(db, '2026-10-26', 'lunch', [
    { foodId: riso, name: 'Riso basmati', grams: 80 },
    { foodId: pollo, name: 'Petto di pollo', grams: 150 },
  ])
  await seedPlanned(db, '2026-10-27', 'dinner', [{ foodId: pollo, name: 'Petto di pollo', grams: 150 }])
  await seedPlanned(db, '2026-10-28', 'lunch', [{ foodId: pollo, name: 'Petto di pollo', grams: 150 }])
  // Saltato o fuori intervallo: non entra.
  await seedPlanned(
    db,
    '2026-10-29',
    'lunch',
    [{ foodId: riso, name: 'Riso basmati', grams: 500 }],
    'skipped',
  )
  await seedPlanned(db, '2026-11-05', 'lunch', [{ foodId: riso, name: 'Riso basmati', grams: 500 }])
  return { api: nutritionApp(db, { now }), pollo, riso }
}

describe('lista della spesa (NUT-011)', () => {
  it('si genera dai pasti pianificati sommando i grammi', async () => {
    const { api } = await setup()
    const res = await api.post('/shopping/generate', { from: '2026-10-26', to: '2026-11-01' })
    expect(res.status).toBe(200)
    expect(res.body.added).toBe(2)
    expect(res.body.items.map((i: Item) => [i.name, i.grams, i.source])).toEqual([
      ['Petto di pollo', 450, 'generated'],
      ['Riso basmati', 80, 'generated'],
    ])
  })

  it('rigenerare aggiunge solo ciò che manca', async () => {
    const { api, riso } = await setup()
    const first = await api.post('/shopping/generate', { from: '2026-10-26', to: '2026-11-01' })
    const pollo = first.body.items.find((i: Item) => i.name === 'Petto di pollo')
    await api.patch(`/shopping/${pollo.id}`, { checked: true })
    await seedPlanned(db, '2026-10-30', 'dinner', [{ foodId: riso, name: 'Riso basmati', grams: 100 }])
    await api.post('/shopping', { name: 'Zucchine' })
    await seedPlanned(db, '2026-10-31', 'dinner', [{ foodId: null as never, name: 'zucchine', grams: 200 }])
    const again = await api.post('/shopping/generate', { from: '2026-10-26', to: '2026-11-01' })
    expect(again.body.added).toBe(0)
    const items: Item[] = again.body.items
    expect(items.find((i) => i.name === 'Petto di pollo')).toMatchObject({ checked: true, grams: 450 })
    expect(items.find((i) => i.name === 'Riso basmati')?.grams).toBe(80)
  })

  it('voci a mano: si aggiungono, si spuntano, si modificano e si eliminano', async () => {
    const api = nutritionApp(db, { now })
    const { body: caffe } = await api.post('/shopping', { name: 'Caffè macinato', text: '1 pacco' })
    expect(caffe).toMatchObject({ name: 'Caffè macinato', text: '1 pacco', source: 'manual', checked: false })
    const { body: limoni } = await api.post('/shopping', { name: 'Limoni', text: '' })
    expect(limoni.text).toBeNull()
    expect((await api.patch(`/shopping/${caffe.id}`, { checked: true })).body).toMatchObject({
      checked: true,
      text: '1 pacco',
    })
    expect((await api.patch(`/shopping/${limoni.id}`, { text: '4' })).body.text).toBe('4')
    expect((await api.patch(`/shopping/${limoni.id}`, { text: null })).body.text).toBeNull()
    expect((await api.delete(`/shopping/${limoni.id}`)).status).toBe(204)
    expect((await api.get('/shopping')).body.items.map((i: Item) => i.name)).toEqual(['Caffè macinato'])
  })

  it('Togli le spuntate le elimina in blocco', async () => {
    const api = nutritionApp(db, { now })
    const a = (await api.post('/shopping', { name: 'Olio' })).body
    const b = (await api.post('/shopping', { name: 'Sale' })).body
    await api.post('/shopping', { name: 'Pepe' })
    await api.patch(`/shopping/${a.id}`, { checked: true })
    await api.patch(`/shopping/${b.id}`, { checked: true })
    const res = await api.delete('/shopping/checked')
    expect(res.body.removed).toBe(2)
    expect(res.body.items.map((i: Item) => i.name)).toEqual(['Pepe'])
  })

  it('richieste non valide: 400; voce sconosciuta: 404', async () => {
    const api = nutritionApp(db, { now })
    expect((await api.post('/shopping/generate', { from: '2026-11-01', to: '2026-10-26' })).status).toBe(400)
    expect((await api.post('/shopping/generate', { from: '2026-10-01', to: '2026-12-01' })).status).toBe(400)
    expect((await api.post('/shopping', { name: ' ' })).status).toBe(400)
    const missing = '00000000-0000-4000-8000-000000000000'
    expect((await api.patch(`/shopping/${missing}`, { checked: true })).status).toBe(404)
    expect((await api.patch(`/shopping/${missing}`, { source: 'manual' })).status).toBe(400)
    expect((await api.delete(`/shopping/${missing}`)).status).toBe(404)
  })
})

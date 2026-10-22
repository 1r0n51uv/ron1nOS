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

type Item = { id: string; name: string; dose: string | null; schedule: string | null; taken: boolean }
const names = (body: { supplements: Item[] }) => body.supplements.map((s) => [s.name, s.taken])

describe('integratori (NUT-014)', () => {
  it('si aggiungono con nome, dose e quando; dose vuota è null', async () => {
    const api = nutritionApp(db, { now })
    const res = await api.post('/supplements', { name: ' Creatina ', dose: '5 g', schedule: 'mattina' })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ name: 'Creatina', dose: '5 g', schedule: 'mattina', active: true })
    await api.post('/supplements', { name: 'Omega 3', dose: '' })
    const list = await api.get('/supplements')
    expect(list.body.supplements.map((s: Item) => [s.name, s.dose])).toEqual([
      ['Creatina', '5 g'],
      ['Omega 3', null],
    ])
  })

  it('la checklist del giorno: si spunta e si toglie, solo per quel giorno', async () => {
    const api = nutritionApp(db, { now })
    const { body: creatina } = await api.post('/supplements', { name: 'Creatina' })
    await api.post('/supplements', { name: 'Vitamina D' })
    expect(names((await api.get('/day?date=2026-10-21')).body)).toEqual([
      ['Creatina', false],
      ['Vitamina D', false],
    ])
    const on = await api.put(`/supplements/${creatina.id}/taken`, { date: '2026-10-21', taken: true })
    expect(on.status).toBe(200)
    expect(names(on.body)).toEqual([
      ['Creatina', true],
      ['Vitamina D', false],
    ])
    // Spuntare due volte non duplica.
    await api.put(`/supplements/${creatina.id}/taken`, { date: '2026-10-21', taken: true })
    expect(names((await api.get('/day?date=2026-10-20')).body)[0]).toEqual(['Creatina', false])
    const off = await api.put(`/supplements/${creatina.id}/taken`, { date: '2026-10-21', taken: false })
    expect(names(off.body)[0]).toEqual(['Creatina', false])
  })

  it('disattivato esce dai giorni in cui non è stato preso; eliminato sparisce', async () => {
    const api = nutritionApp(db, { now })
    const { body: d } = await api.post('/supplements', { name: 'Vitamina D', schedule: 'sera' })
    await api.put(`/supplements/${d.id}/taken`, { date: '2026-10-20', taken: true })
    const patched = await api.patch(`/supplements/${d.id}`, { active: false })
    expect(patched.body).toMatchObject({ active: false, schedule: 'sera' })
    expect(names((await api.get('/day?date=2026-10-21')).body)).toEqual([])
    expect(names((await api.get('/day?date=2026-10-20')).body)).toEqual([['Vitamina D', true]])
    expect((await api.delete(`/supplements/${d.id}`)).status).toBe(204)
    expect(names((await api.get('/day?date=2026-10-20')).body)).toEqual([])
    expect((await api.delete(`/supplements/${d.id}`)).status).toBe(404)
  })

  it('richieste non valide: 400; sconosciuto: 404', async () => {
    const api = nutritionApp(db, { now })
    expect((await api.post('/supplements', { name: ' ' })).status).toBe(400)
    expect((await api.patch('/supplements/xyz', { active: false })).status).toBe(400)
    const missing = '00000000-0000-4000-8000-000000000000'
    expect((await api.patch(`/supplements/${missing}`, { active: false })).status).toBe(404)
    expect((await api.put(`/supplements/${missing}/taken`, { date: '2026-10-21', taken: true })).status).toBe(
      404,
    )
    const { body } = await api.post('/supplements', { name: 'Creatina' })
    expect((await api.put(`/supplements/${body.id}/taken`, { date: 'oggi', taken: true })).status).toBe(400)
  })
})

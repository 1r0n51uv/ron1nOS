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
type Body = {
  slots: {
    slot: string
    state: string
    meal: { kcal: number; items: { id: string; name: string; grams: number }[] } | null
    planned: {
      id: string
      status: string
      recipeName: string | null
      kcal: number
      items: { name: string }[]
    } | null
  }[]
}
const slot = (body: Body, id: string) => body.slots.find((s) => s.slot === id)!

async function setup() {
  const riso = await seedFood(db, { name: 'Riso basmati', kcal: 350, protein: 7, carbs: 78, fat: 0.6 })
  const pollo = await seedFood(db, { name: 'Petto di pollo', kcal: 110, protein: 23, carbs: 0, fat: 1.2 })
  const api = nutritionApp(db, { now })
  return { riso, pollo, api }
}

describe('pianificare un pasto (NUT-009)', () => {
  it('una lista di alimenti nel futuro', async () => {
    const { riso, pollo, api } = await setup()
    const res = await api.put('/plans', {
      date: '2026-10-25',
      slot: 'lunch',
      items: [
        { foodId: riso, grams: 80 },
        { foodId: pollo, grams: 150 },
      ],
    })
    expect(res.status).toBe(200)
    expect(res.body.date).toBe('2026-10-25')
    expect(slot(res.body, 'lunch')).toMatchObject({
      state: 'planned',
      meal: null,
      planned: { status: 'planned', kcal: 445, recipeName: null },
    })
    expect(res.body.plannedKcal).toBe(445)
  })

  it('una ricetta, che il piano ricorda', async () => {
    const { riso, pollo, api } = await setup()
    const { body: recipe } = await api.post('/recipes', {
      name: 'Riso e pollo',
      items: [
        { foodId: riso, grams: 80 },
        { foodId: pollo, grams: 150 },
      ],
    })
    const res = await api.put('/plans', {
      date: '2026-10-19',
      slot: 'dinner',
      items: [{ recipeId: recipe.id }],
    })
    expect(slot(res.body, 'dinner').planned).toMatchObject({ recipeName: 'Riso e pollo', kcal: 445 })
  })

  it('si sostituisce finché non è mangiato', async () => {
    const { riso, pollo, api } = await setup()
    await api.put('/plans', { date: '2026-10-21', slot: 'lunch', items: [{ foodId: riso, grams: 80 }] })
    const res = await api.put('/plans', {
      date: '2026-10-21',
      slot: 'lunch',
      items: [{ foodId: pollo, grams: 200 }],
    })
    expect(slot(res.body, 'lunch').planned?.items.map((i) => i.name)).toEqual(['Petto di pollo'])
    const { rows } = await db.query('select count(*)::int as n from planned_meals')
    expect(rows[0]).toEqual({ n: 1 })

    const plan = slot(res.body, 'lunch').planned!.id
    await api.put(`/plans/${plan}/status`, { status: 'eaten' })
    const again = await api.put('/plans', {
      date: '2026-10-21',
      slot: 'lunch',
      items: [{ foodId: riso, grams: 80 }],
    })
    expect(again.status).toBe(409)
    expect(again.body.error).toBe('plan_eaten')
    expect((await api.delete(`/plans/${plan}`)).status).toBe(409)
  })

  it('mangiato crea le righe del diario; spegnerlo le cancella', async () => {
    const { riso, pollo, api } = await setup()
    const planned = await api.put('/plans', {
      date: '2026-10-21',
      slot: 'lunch',
      items: [
        { foodId: riso, grams: 80 },
        { foodId: pollo, grams: 150 },
      ],
    })
    const id = slot(planned.body, 'lunch').planned!.id
    const eaten = await api.put(`/plans/${id}/status`, { status: 'eaten' })
    expect(slot(eaten.body, 'lunch')).toMatchObject({ state: 'eaten', planned: { status: 'eaten' } })
    expect(slot(eaten.body, 'lunch').meal?.items.map((i) => [i.name, i.grams])).toEqual([
      ['Riso basmati', 80],
      ['Petto di pollo', 150],
    ])
    expect(eaten.body.totals.kcal).toBe(445)
    expect(eaten.body.plannedKcal).toBe(0)

    const off = await api.put(`/plans/${id}/status`, { status: 'planned' })
    expect(slot(off.body, 'lunch')).toMatchObject({ state: 'planned', meal: null })
    expect(off.body.totals.kcal).toBe(0)
    const { rows } = await db.query('select count(*)::int as n from meal_entries')
    expect(rows[0]).toEqual({ n: 0 })
  })

  it('spegnere mangiato tiene gli extra registrati a mano', async () => {
    const { riso, pollo, api } = await setup()
    const planned = await api.put('/plans', {
      date: '2026-10-21',
      slot: 'lunch',
      items: [{ foodId: riso, grams: 80 }],
    })
    const id = slot(planned.body, 'lunch').planned!.id
    await api.put(`/plans/${id}/status`, { status: 'eaten' })
    await api.post('/meals', { date: '2026-10-21', slot: 'lunch', items: [{ foodId: pollo, grams: 100 }] })
    const off = await api.put(`/plans/${id}/status`, { status: 'skipped' })
    expect(slot(off.body, 'lunch').meal?.items.map((i) => i.name)).toEqual(['Petto di pollo'])
    expect(slot(off.body, 'lunch').planned?.status).toBe('skipped')
  })

  it('saltato, poi di nuovo pianificato; si elimina', async () => {
    const { riso, api } = await setup()
    const planned = await api.put('/plans', {
      date: '2026-10-21',
      slot: 'dinner',
      items: [{ foodId: riso, grams: 80 }],
    })
    const id = slot(planned.body, 'dinner').planned!.id
    expect(slot((await api.put(`/plans/${id}/status`, { status: 'skipped' })).body, 'dinner').state).toBe(
      'skipped',
    )
    expect(slot((await api.put(`/plans/${id}/status`, { status: 'planned' })).body, 'dinner').state).toBe(
      'planned',
    )
    const del = await api.delete(`/plans/${id}`)
    expect(slot(del.body, 'dinner')).toMatchObject({ state: 'empty', planned: null })
  })

  it('togliere l’ultima riga di un pasto da piano lo segna saltato', async () => {
    const { riso, api } = await setup()
    const planned = await api.put('/plans', {
      date: '2026-10-21',
      slot: 'dinner',
      items: [{ foodId: riso, grams: 80 }],
    })
    const id = slot(planned.body, 'dinner').planned!.id
    const eaten = await api.put(`/plans/${id}/status`, { status: 'eaten' })
    const row = slot(eaten.body, 'dinner').meal!.items[0].id
    const res = await api.delete(`/meals/items/${row}`)
    expect(slot(res.body, 'dinner')).toMatchObject({ state: 'skipped', planned: { status: 'skipped' } })
  })

  it('richieste non valide: 400; piano sconosciuto: 404', async () => {
    const { api } = await setup()
    const missing = '00000000-0000-4000-8000-000000000000'
    expect((await api.put('/plans', { date: '2026-10-21', slot: 'lunch', items: [] })).status).toBe(400)
    expect((await api.put(`/plans/${missing}/status`, { status: 'eaten' })).status).toBe(404)
    expect((await api.put(`/plans/${missing}/status`, { status: 'boh' })).status).toBe(400)
    expect((await api.delete(`/plans/${missing}`)).status).toBe(404)
  })
})

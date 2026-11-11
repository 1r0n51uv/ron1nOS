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

describe('programmazione di un template (NUT-031)', () => {
  // 2026-10-21 è un mercoledì: lunedì 19, domenica 25.
  const plan = {
    name: 'Settimana tipo',
    cells: [] as { weekday: number; slot: string; recipeId: string }[],
  }

  async function withTemplate() {
    const { api, recipe } = await setup()
    const res = await api.post('/templates', {
      ...plan,
      cells: [
        { weekday: 1, slot: 'lunch', recipeId: recipe.id },
        { weekday: 3, slot: 'dinner', recipeId: recipe.id },
        { weekday: 5, slot: 'lunch', recipeId: recipe.id },
      ],
    })
    return { api, template: res.body as { id: string } }
  }

  const planned = async (api: Awaited<ReturnType<typeof setup>>['api'], from: string) =>
    (await api.get(`/week?from=${from}`)).body.days.map(
      (d: { date: string; slots: { slot: string; state: string }[] }) => [
        d.date,
        d.slots.filter((s) => s.state !== 'empty').map((s) => `${s.slot}:${s.state}`),
      ],
    )

  it('senza data vale fino a domenica della settimana di from', async () => {
    const { api, template } = await withTemplate()
    const res = await api.post(`/templates/${template.id}/schedule`, { from: '2026-10-21' })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      created: 2,
      removed: 0,
      kept: 0,
      from: '2026-10-21',
      until: '2026-10-25',
    })
    expect(await planned(api, '2026-10-19')).toEqual([
      ['2026-10-19', []],
      ['2026-10-20', []],
      ['2026-10-21', ['dinner:planned']],
      ['2026-10-22', []],
      ['2026-10-23', ['lunch:planned']],
      ['2026-10-24', []],
      ['2026-10-25', []],
    ])
  })

  it('con una data ripete la settimana fino a quel giorno compreso', async () => {
    const { api, template } = await withTemplate()
    const res = await api.post(`/templates/${template.id}/schedule`, {
      from: '2026-10-19',
      until: '2026-10-27',
    })
    // lun 19, mer 21, ven 23, lun 26 (il 27 è martedì: niente).
    expect(res.body).toMatchObject({ created: 4, until: '2026-10-27' })
    const next = await planned(api, '2026-10-26')
    expect(next[0]).toEqual(['2026-10-26', ['lunch:planned']])
    expect(next[1]).toEqual(['2026-10-27', []])
  })

  it('rifà i pianificati e lascia mangiati e saltati', async () => {
    const { api, template } = await withTemplate()
    await api.post(`/templates/${template.id}/schedule`, { from: '2026-10-19' })
    const week = (await api.get('/week?from=2026-10-19')).body
    const monday = week.days[0].slots.find((s: { slot: string }) => s.slot === 'lunch').plan
    const friday = week.days[4].slots.find((s: { slot: string }) => s.slot === 'lunch').plan
    await api.put(`/plans/${monday.id}/status`, { status: 'eaten' })
    await api.put(`/plans/${friday.id}/status`, { status: 'skipped' })

    const res = await api.post(`/templates/${template.id}/schedule`, { from: '2026-10-19' })
    expect(res.body).toMatchObject({ removed: 1, created: 1, kept: 2 })
    expect(await planned(api, '2026-10-19')).toEqual([
      ['2026-10-19', ['lunch:eaten']],
      ['2026-10-20', []],
      ['2026-10-21', ['dinner:planned']],
      ['2026-10-22', []],
      ['2026-10-23', ['lunch:skipped']],
      ['2026-10-24', []],
      ['2026-10-25', []],
    ])
  })

  it('toglie i pianificati che il nuovo piano non ha più', async () => {
    const { api, template } = await withTemplate()
    await api.post(`/templates/${template.id}/schedule`, { from: '2026-10-19' })
    const { body: vuoto } = await api.post('/templates', { name: 'Vuoto', cells: [] })
    await api.post(`/templates/${vuoto.id}/schedule`, { from: '2026-10-21' })
    const days = await planned(api, '2026-10-19')
    // Il 19 è prima di from: resta; dal 21 in poi è vuoto.
    expect(days[0]).toEqual(['2026-10-19', ['lunch:planned']])
    expect(days.slice(2).every(([, s]: [string, string[]]) => s.length === 0)).toBe(true)
  })

  it.each([
    ['la data finale è prima', { from: '2026-10-21', until: '2026-10-20' }],
    ['dura più di un anno', { from: '2026-10-21', until: '2027-12-01' }],
    ['la data non è valida', { from: '2026-13-01' }],
  ])('rifiuta se %s', async (_, body) => {
    const { api, template } = await withTemplate()
    const res = await api.post(`/templates/${template.id}/schedule`, body)
    expect(res.status).toBe(400)
  })

  it('template sconosciuto: 404', async () => {
    const { api } = await withTemplate()
    const res = await api.post('/templates/00000000-0000-4000-8000-000000000000/schedule', {
      from: '2026-10-21',
    })
    expect(res.status).toBe(404)
  })
})

describe('settimana (NUT-032)', () => {
  it('parte da lunedì e dà ricetta, stato e kcal di ogni pasto', async () => {
    const { api, recipe } = await setup()
    await api.put('/plans', {
      date: '2026-10-21',
      slot: 'lunch',
      items: [{ recipeId: recipe.id, factor: 1 }],
    })
    const res = await api.get('/week?from=2026-10-19')
    expect(res.status).toBe(200)
    expect(res.body.days.map((d: { date: string }) => d.date)).toEqual([
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
    ])
    const lunch = res.body.days[2].slots.find((s: { slot: string }) => s.slot === 'lunch')
    expect(lunch).toMatchObject({
      state: 'planned',
      kcal: 445,
      plan: { status: 'planned', recipeId: recipe.id, name: 'Riso e pollo' },
    })
    expect(res.body.days[2].plannedKcal).toBe(445)
    expect(res.body.days[0].slots.every((s: { state: string }) => s.state === 'empty')).toBe(true)
  })

  it('senza from è la settimana corrente', async () => {
    const { api } = await setup()
    const res = await api.get('/week')
    expect(res.body.from).toBe('2026-10-19')
  })

  it('rifiuta una data che non è lunedì', async () => {
    const { api } = await setup()
    expect((await api.get('/week?from=2026-10-21')).status).toBe(400)
  })

  it('porta la foto della ricetta programmata, nella settimana e nel giorno', async () => {
    const { api, recipe } = await setup()
    await db.query(`update recipes set image_url = $2 where id = $1`, [
      recipe.id,
      'https://images.yazio.com/app/recipe/yazio/recipe-1.jpg',
    ])
    await api.put('/plans', {
      date: '2026-10-21',
      slot: 'lunch',
      items: [{ recipeId: recipe.id, factor: 1 }],
    })
    const atteso =
      'https://images.yazio-cdn.com/process/w:684/h:558/rt:fill/f:webp/plain/app/recipe/yazio/recipe-1.jpg'
    const settimana = (await api.get('/week?from=2026-10-19')).body
    const pranzo = settimana.days[2].slots.find((s: { slot: string }) => s.slot === 'lunch')
    expect(pranzo.plan.imageUrl).toBe(atteso)
    const giorno = (await api.get('/day?date=2026-10-21')).body
    expect(giorno.slots.find((s: { slot: string }) => s.slot === 'lunch').planned.recipeImage).toBe(atteso)
    // Un pasto senza foto: null.
    const vuoto = settimana.days[0].slots[0]
    expect(vuoto.plan).toBeNull()
  })
})

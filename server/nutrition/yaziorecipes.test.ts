// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import type { Queryable } from '../db.ts'
import { testDb } from '../testing/db.ts'
import { createFakeYazio, FAKE_CLIENT, FAKE_USER } from '../testing/fake-yazio.ts'
import { nutritionApp, resetNutrition } from '../testing/nutrition.ts'
import { createYazioClient } from '../yazio/client.ts'
import { dbTokenStore } from '../yazio/tokens.ts'

let db: Awaited<ReturnType<typeof testDb>>
beforeAll(async () => {
  db = await testDb()
})
afterAll(() => db.drop())
beforeEach(() => resetNutrition(db))

const now = () => new Date('2026-11-09T10:00:00Z')

function setup() {
  const fake = createFakeYazio()
  const yazio = (q: Queryable) =>
    createYazioClient({
      url: 'http://yazio.test/v20',
      clientId: FAKE_CLIENT.id,
      clientSecret: FAKE_CLIENT.secret,
      username: FAKE_USER.username,
      password: FAKE_USER.password,
      tokens: dbTokenStore(q, 'chiave-di-prova'),
      fetch: fake.fetch as typeof fetch,
      sleep: async () => {},
    })
  fake.state.recipes = [
    {
      id: 'r-colazione',
      name: 'Yogurt e mela',
      items: [
        { productId: 'p-yogurt', grams: 200 },
        { productId: 'p-mela', grams: 150 },
      ],
    },
    { id: 'r-snack', name: 'Grissini', items: [{ productId: 'p-grissini', grams: 40 }] },
  ]
  return { fake, api: nutritionApp(db, { now, yazio }) }
}

const names = async (api: ReturnType<typeof setup>['api']) =>
  (await api.get('/recipes')).body.recipes.map((r: { name: string }) => r.name)

describe('import dei preferiti YAZIO (NUT-008)', () => {
  it('senza YAZIO configurato è rifiutato', async () => {
    const res = await nutritionApp(db, { now }).post('/recipes/yazio/import')
    expect(res.status).toBe(409)
    expect(res.body.error).toBe('yazio_not_configured')
  })

  it('crea le ricette con gli alimenti YAZIO e le kcal calcolate dagli ingredienti', async () => {
    const { api } = setup()
    const res = await api.post('/recipes/yazio/import')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      created: 2,
      updated: 0,
      skipped: [],
      skippedItems: 0,
      removedUpstream: 0,
    })
    const { recipes } = (await api.get('/recipes')).body
    const colazione = recipes.find((r: { name: string }) => r.name === 'Yogurt e mela')
    expect(colazione).toMatchObject({ kcal: 224, grams: 350 })
    expect(colazione.items.map((i: { name: string; grams: number }) => [i.name, i.grams])).toEqual([
      ['Yogurt greco bianco 2%', 200],
      ['Mela', 150],
    ])
    const { rows } = await db.query(`select source, yazio_product_id from foods order by name`)
    expect(rows).toEqual([
      { source: 'yazio', yazio_product_id: 'p-grissini' },
      { source: 'yazio', yazio_product_id: 'p-mela' },
      { source: 'yazio', yazio_product_id: 'p-yogurt' },
    ])
  })

  it('ripetuto aggiorna nome e ingredienti senza duplicare né toccare le note', async () => {
    const { api, fake } = setup()
    await api.post('/recipes/yazio/import')
    const id = (await api.get('/recipes')).body.recipes.find(
      (r: { name: string }) => r.name === 'Grissini',
    ).id
    await db.query('update recipes set notes = $2 where id = $1', [id, 'Con il tè'])

    fake.state.recipes[1] = {
      id: 'r-snack',
      name: 'Grissini del pomeriggio',
      items: [{ productId: 'p-grissini', grams: 60 }],
    }
    const res = await api.post('/recipes/yazio/import')
    expect(res.body).toMatchObject({ created: 0, updated: 2 })

    expect(await names(api)).toEqual(['Grissini del pomeriggio', 'Yogurt e mela'])
    const again = (await api.get(`/recipes/${id}`)).body
    expect(again).toMatchObject({ notes: 'Con il tè', grams: 60 })
    expect((await db.query('select count(*)::int as n from foods')).rows[0]).toEqual({ n: 3 })
  })

  it('riusa un alimento già nel catalogo con lo stesso prodotto YAZIO', async () => {
    const { api } = setup()
    await db.query(
      `insert into foods (name, source, calories_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g, yazio_product_id)
       values ('Mela Golden', 'custom', 50, 0, 12, 0, 'p-mela')`,
    )
    await api.post('/recipes/yazio/import')
    const { recipes } = (await api.get('/recipes')).body
    const colazione = recipes.find((r: { name: string }) => r.name === 'Yogurt e mela')
    expect(colazione.items.map((i: { name: string }) => i.name)).toContain('Mela Golden')
    expect(
      (await db.query(`select count(*)::int as n from foods where yazio_product_id = 'p-mela'`)).rows[0],
    ).toEqual({ n: 1 })
  })

  it('salta gli ingredienti non in grammi e le ricette rimaste senza', async () => {
    const { api, fake } = setup()
    fake.state.recipes = [
      {
        id: 'r-misto',
        name: 'Misto',
        items: [
          { productId: 'p-mela', grams: 100 },
          { productId: 'p-yogurt', grams: 100, unit: 'ml' },
        ],
      },
      { id: 'r-solo-ml', name: 'Solo ml', items: [{ productId: 'p-mela', grams: 100, unit: 'ml' }] },
    ]
    const res = await api.post('/recipes/yazio/import')
    expect(res.body).toMatchObject({
      created: 1,
      skippedItems: 2,
      skipped: [{ yazioId: 'r-solo-ml', reason: 'no_items' }],
    })
    expect(await names(api)).toEqual(['Misto'])
  })

  it('una ricetta tolta dai preferiti resta, e viene segnalata', async () => {
    const { api, fake } = setup()
    await api.post('/recipes/yazio/import')
    fake.state.recipes = fake.state.recipes.slice(0, 1)
    const res = await api.post('/recipes/yazio/import')
    expect(res.body).toMatchObject({ updated: 1, removedUpstream: 1 })
    expect(await names(api)).toEqual(['Grissini', 'Yogurt e mela'])
  })

  it('se YAZIO non risponde dà 503 e non cambia nulla', async () => {
    const { api, fake } = setup()
    fake.state.online = false
    const res = await api.post('/recipes/yazio/import')
    expect(res.status).toBe(503)
    expect(await names(api)).toEqual([])
  })
})

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

async function foods() {
  return {
    riso: await seedFood(db, { name: 'Riso basmati', kcal: 350, protein: 7, carbs: 78, fat: 0.6 }),
    pollo: await seedFood(db, { name: 'Petto di pollo', kcal: 110, protein: 23, carbs: 0, fat: 1.2 }),
    zucchine: await seedFood(db, { name: 'Zucchine', kcal: 17, protein: 1.2, carbs: 3.1, fat: 0.3 }),
  }
}

describe('ricette (NUT-008)', () => {
  it('si crea con nome, note e alimenti; mostra kcal e macro totali', async () => {
    const f = await foods()
    const api = nutritionApp(db, { now })
    const res = await api.post('/recipes', {
      name: 'Riso, pollo e zucchine',
      notes: "Zucchine in padella con un filo d'olio.",
      items: [
        { foodId: f.riso, grams: 80 },
        { foodId: f.pollo, grams: 150 },
        { foodId: f.zucchine, grams: 200 },
      ],
    })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({
      name: 'Riso, pollo e zucchine',
      notes: "Zucchine in padella con un filo d'olio.",
      kcal: 479,
      protein: 42.5,
      grams: 430,
    })
    expect(res.body.items.map((i: { name: string; kcal: number }) => [i.name, i.kcal])).toEqual([
      ['Riso basmati', 280],
      ['Petto di pollo', 165],
      ['Zucchine', 34],
    ])
    const list = await api.get('/recipes')
    expect(list.body.recipes.map((r: { name: string }) => r.name)).toEqual(['Riso, pollo e zucchine'])
  })

  it('un risultato esterno entra nel catalogo; note vuote valgono null', async () => {
    const api = nutritionApp(db, { now })
    const res = await api.post('/recipes', {
      name: 'Yogurt',
      notes: '',
      items: [
        {
          food: {
            source: 'usda',
            externalId: '1',
            name: 'Yogurt, greek',
            kcal: 59,
            protein: 10,
            carbs: 3.6,
            fat: 0.4,
          },
          grams: 170,
        },
      ],
    })
    expect(res.body).toMatchObject({ notes: null, kcal: 100 })
    expect(res.body.items[0].foodId).toEqual(expect.any(String))
  })

  it('si modifica sostituendo gli alimenti, e si elimina', async () => {
    const f = await foods()
    const api = nutritionApp(db, { now })
    const { body } = await api.post('/recipes', { name: 'Pranzo', items: [{ foodId: f.riso, grams: 80 }] })
    const put = await api.put(`/recipes/${body.id}`, {
      name: 'Pranzo leggero',
      items: [{ foodId: f.zucchine, grams: 300 }],
    })
    expect(put.body).toMatchObject({ name: 'Pranzo leggero', kcal: 51 })
    expect(put.body.items).toHaveLength(1)
    expect((await api.delete(`/recipes/${body.id}`)).status).toBe(204)
    expect((await api.get(`/recipes/${body.id}`)).status).toBe(404)
  })

  it('un alimento eliminato resta nella ricetta ma non conta', async () => {
    const f = await foods()
    const api = nutritionApp(db, { now })
    const { body } = await api.post('/recipes', {
      name: 'Pranzo',
      items: [
        { foodId: f.riso, grams: 80 },
        { foodId: f.pollo, grams: 150 },
      ],
    })
    await db.query('delete from foods where id = $1', [f.pollo])
    const res = await api.get(`/recipes/${body.id}`)
    expect(res.body.kcal).toBe(280)
    expect(res.body.items[1]).toMatchObject({ name: 'Petto di pollo', foodId: null, missing: true, kcal: 0 })
  })

  it('si registra in un colpo, anche per più porzioni', async () => {
    const f = await foods()
    const api = nutritionApp(db, { now })
    const { body: recipe } = await api.post('/recipes', {
      name: 'Pranzo',
      items: [
        { foodId: f.riso, grams: 80 },
        { foodId: f.pollo, grams: 150 },
      ],
    })
    const res = await api.post('/meals', {
      date: '2026-10-21',
      slot: 'lunch',
      items: [{ recipeId: recipe.id, factor: 1.5 }],
    })
    expect(res.status).toBe(201)
    const lunch = res.body.slots.find((s: { slot: string }) => s.slot === 'lunch')
    expect(lunch.meal.items.map((i: { name: string; grams: number }) => [i.name, i.grams])).toEqual([
      ['Riso basmati', 120],
      ['Petto di pollo', 225],
    ])
  })

  it('richieste non valide: 400; ricetta sconosciuta: 404', async () => {
    const api = nutritionApp(db, { now })
    expect((await api.post('/recipes', { name: 'Vuota', items: [] })).status).toBe(400)
    expect(
      (await api.post('/recipes', { name: ' ', items: [{ foodId: crypto.randomUUID(), grams: 1 }] })).status,
    ).toBe(400)
    const missing = '00000000-0000-4000-8000-000000000000'
    expect((await api.post('/recipes', { name: 'X', items: [{ foodId: missing, grams: 10 }] })).status).toBe(
      404,
    )
    expect(
      (await api.put(`/recipes/${missing}`, { name: 'X', items: [{ foodId: missing, grams: 10 }] })).status,
    ).toBe(404)
    expect((await api.delete(`/recipes/${missing}`)).status).toBe(404)
    expect(
      (await api.post('/meals', { date: '2026-10-21', slot: 'lunch', items: [{ recipeId: missing }] }))
        .status,
    ).toBe(404)
  })
})

describe('azioni collegate a una ricetta (NUT-035)', () => {
  const scongela = { id: 'a1', title: 'Scongela il pesce', daysBefore: 1, time: '21:00', enabled: true }
  const spesa = { id: 'a2', title: 'Compra il limone', daysBefore: 2, time: '18:30', enabled: false }

  it('si salvano, si correggono e senza si lasciano com’erano', async () => {
    const f = await foods()
    const api = nutritionApp(db, { now })
    const created = await api.post('/recipes', {
      name: 'Pesce al forno',
      actions: [scongela, spesa],
      items: [{ foodId: f.pollo, grams: 150 }],
    })
    expect(created.status).toBe(201)
    expect(created.body.actions).toEqual([scongela, spesa])
    const kept = await api.put(`/recipes/${created.body.id}`, {
      name: 'Pesce al forno',
      items: [{ foodId: f.pollo, grams: 150 }],
    })
    expect(kept.body.actions).toEqual([scongela, spesa])
    const cleared = await api.put(`/recipes/${created.body.id}`, {
      name: 'Pesce al forno',
      actions: [],
      items: [{ foodId: f.pollo, grams: 150 }],
    })
    expect(cleared.body.actions).toEqual([])
  })

  it.each([
    ['un orario che non è tale', { ...scongela, time: '9 di sera' }],
    ['troppi giorni prima', { ...scongela, daysBefore: 15 }],
    ['un titolo vuoto', { ...scongela, title: ' ' }],
  ])('rifiuta %s', async (_, action) => {
    const f = await foods()
    const res = await nutritionApp(db, { now }).post('/recipes', {
      name: 'Pesce',
      actions: [action],
      items: [{ foodId: f.pollo, grams: 150 }],
    })
    expect(res.status).toBe(400)
  })
})

describe('procedimento di una ricetta (NUT-030)', () => {
  it('si salva, si corregge e si legge nell’ordine dei passi', async () => {
    const f = await foods()
    const api = nutritionApp(db, { now })
    const created = await api.post('/recipes', {
      name: 'Riso e pollo',
      steps: ['Cuoci il riso.', '  Griglia il pollo.  '],
      items: [{ foodId: f.riso, grams: 80 }],
    })
    expect(created.status).toBe(201)
    expect(created.body.steps).toEqual(['Cuoci il riso.', 'Griglia il pollo.'])

    const updated = await api.put(`/recipes/${created.body.id}`, {
      name: 'Riso e pollo',
      steps: ['Griglia il pollo.', 'Cuoci il riso.', 'Impiatta.'],
      items: [{ foodId: f.riso, grams: 80 }],
    })
    expect(updated.body.steps).toEqual(['Griglia il pollo.', 'Cuoci il riso.', 'Impiatta.'])
    expect((await api.get(`/recipes/${created.body.id}`)).body.steps).toHaveLength(3)
  })

  it('una modifica senza passi li lascia come erano', async () => {
    const f = await foods()
    const api = nutritionApp(db, { now })
    const created = await api.post('/recipes', {
      name: 'Riso',
      steps: ['Cuoci il riso.'],
      items: [{ foodId: f.riso, grams: 80 }],
    })
    const updated = await api.put(`/recipes/${created.body.id}`, {
      name: 'Riso basmati',
      items: [{ foodId: f.riso, grams: 100 }],
    })
    expect(updated.body).toMatchObject({ name: 'Riso basmati', steps: ['Cuoci il riso.'] })
    const cleared = await api.put(`/recipes/${created.body.id}`, {
      name: 'Riso basmati',
      steps: [],
      items: [{ foodId: f.riso, grams: 100 }],
    })
    expect(cleared.body.steps).toEqual([])
  })

  it('senza passi è un elenco vuoto', async () => {
    const f = await foods()
    const api = nutritionApp(db, { now })
    const res = await api.post('/recipes', { name: 'Solo riso', items: [{ foodId: f.riso, grams: 80 }] })
    expect(res.body.steps).toEqual([])
  })

  it.each([
    ['un passo vuoto', ['Cuoci', '  ']],
    ['un passo troppo lungo', ['x'.repeat(1001)]],
    ['troppi passi', Array.from({ length: 51 }, () => 'passo')],
  ])('rifiuta %s', async (_, steps) => {
    const f = await foods()
    const api = nutritionApp(db, { now })
    const res = await api.post('/recipes', { name: 'X', steps, items: [{ foodId: f.riso, grams: 80 }] })
    expect(res.status).toBe(400)
  })

  describe('categorie (NUT-037)', () => {
    it('si salvano alla creazione e cambiano da sole con PATCH', async () => {
      const f = await foods()
      const api = nutritionApp(db, { now })
      const created = await api.post('/recipes', {
        name: 'Insalata di riso',
        categories: ['lunch', 'cold'],
        items: [{ foodId: f.riso, grams: 80 }],
      })
      expect(created.body.categories).toEqual(['lunch', 'cold'])
      const patched = await api.patch(`/recipes/${created.body.id}`, {
        categories: ['dinner', 'dinner', 'hot'],
      })
      expect(patched.status).toBe(200)
      expect(patched.body.categories).toEqual(['dinner', 'hot'])
      expect(patched.body.items).toHaveLength(1)
    })

    it('senza categorie è un elenco vuoto, e una modifica che le omette le lascia', async () => {
      const f = await foods()
      const api = nutritionApp(db, { now })
      const created = await api.post('/recipes', { name: 'Riso', items: [{ foodId: f.riso, grams: 80 }] })
      expect(created.body.categories).toEqual([])
      await api.patch(`/recipes/${created.body.id}`, { categories: ['snack'] })
      const updated = await api.put(`/recipes/${created.body.id}`, {
        name: 'Riso',
        items: [{ foodId: f.riso, grams: 90 }],
      })
      expect(updated.body.categories).toEqual(['snack'])
    })

    it('rifiuta una categoria che non esiste e PATCH su una ricetta assente', async () => {
      const f = await foods()
      const api = nutritionApp(db, { now })
      const bad = await api.post('/recipes', {
        name: 'X',
        categories: ['brunch'],
        items: [{ foodId: f.riso, grams: 80 }],
      })
      expect(bad.status).toBe(400)
      const missing = await api.patch('/recipes/00000000-0000-4000-8000-000000000000', { categories: [] })
      expect(missing.status).toBe(404)
    })
  })

  describe('ricette composte (NUT-037)', () => {
    async function parti() {
      const f = await foods()
      const api = nutritionApp(db, { now })
      const pollo = await api.post('/recipes', { name: 'Pollo', items: [{ foodId: f.pollo, grams: 150 }] })
      const zucchine = await api.post('/recipes', {
        name: 'Zucchine',
        items: [{ foodId: f.zucchine, grams: 200 }],
      })
      const riso = await api.post('/recipes', { name: 'Crackers', items: [{ foodId: f.riso, grams: 40 }] })
      return { api, f, pollo: pollo.body.id, zucchine: zucchine.body.id, crackers: riso.body.id }
    }

    it('somma kcal, macro e alimenti delle parti, per porzioni', async () => {
      const { api, pollo, zucchine, crackers } = await parti()
      const res = await api.post('/recipes', {
        name: 'Pranzo leggero',
        categories: ['lunch'],
        parts: [
          { role: 'course', recipeId: pollo },
          { role: 'side', recipeId: zucchine, factor: 1.5 },
          { role: 'bread', recipeId: crackers, factor: 0.5 },
        ],
      })
      expect(res.status).toBe(201)
      // 165 + 51 + 70 kcal; 150 + 300 + 20 g.
      expect(res.body).toMatchObject({ kcal: 286, grams: 470 })
      expect(res.body.items.map((i: { name: string; grams: number }) => [i.name, i.grams])).toEqual([
        ['Petto di pollo', 150],
        ['Zucchine', 300],
        ['Riso basmati', 20],
      ])
      expect(
        res.body.parts.map((p: { role: string; name: string; factor: number; kcal: number }) => [
          p.role,
          p.name,
          p.factor,
          p.kcal,
        ]),
      ).toEqual([
        ['course', 'Pollo', 1, 165],
        ['side', 'Zucchine', 1.5, 51],
        ['bread', 'Crackers', 0.5, 70],
      ])
    })

    it('una ricetta semplice non ha parti, e una composta si può programmare', async () => {
      const { api, pollo, zucchine } = await parti()
      expect((await api.get(`/recipes/${pollo}`)).body.parts).toEqual([])
      const composed = await api.post('/recipes', {
        name: 'Cena',
        parts: [
          { role: 'course', recipeId: pollo },
          { role: 'side', recipeId: zucchine },
        ],
      })
      const plan = await api.put('/plans', {
        date: '2026-10-22',
        slot: 'dinner',
        items: [{ recipeId: composed.body.id, factor: 1 }],
      })
      expect(plan.status).toBe(200)
      expect(plan.body.slots.find((s: { slot: string }) => s.slot === 'dinner').planned.kcal).toBe(199)
    })

    it('si corregge cambiando le parti, o tornando ad alimenti', async () => {
      const { api, f, pollo, zucchine } = await parti()
      const created = await api.post('/recipes', {
        name: 'Cena',
        parts: [{ role: 'course', recipeId: pollo }],
      })
      const more = await api.put(`/recipes/${created.body.id}`, {
        name: 'Cena',
        parts: [
          { role: 'course', recipeId: pollo },
          { role: 'side', recipeId: zucchine },
        ],
      })
      expect(more.body.parts).toHaveLength(2)
      const simple = await api.put(`/recipes/${created.body.id}`, {
        name: 'Cena',
        items: [{ foodId: f.riso, grams: 100 }],
      })
      expect(simple.body.parts).toEqual([])
      expect(simple.body.kcal).toBe(350)
    })

    it('non si annida, non contiene se stessa e non vuole alimenti insieme alle parti', async () => {
      const { api, f, pollo, zucchine } = await parti()
      const composed = await api.post('/recipes', {
        name: 'Cena',
        parts: [{ role: 'course', recipeId: pollo }],
      })
      const nested = await api.post('/recipes', {
        name: 'Doppia',
        parts: [{ role: 'course', recipeId: composed.body.id }],
      })
      expect(nested.status).toBe(400)
      const self = await api.put(`/recipes/${zucchine}`, {
        name: 'Zucchine',
        parts: [{ role: 'side', recipeId: zucchine }],
      })
      expect(self.status).toBe(400)
      const both = await api.post('/recipes', {
        name: 'Misto',
        parts: [{ role: 'course', recipeId: pollo }],
        items: [{ foodId: f.riso, grams: 10 }],
      })
      expect(both.status).toBe(400)
      const none = await api.post('/recipes', { name: 'Vuota' })
      expect(none.status).toBe(400)
      const absent = await api.post('/recipes', {
        name: 'Fantasma',
        parts: [{ role: 'course', recipeId: '00000000-0000-4000-8000-000000000000' }],
      })
      expect(absent.status).toBe(404)
    })

    it('una ricetta usata da una composta non si elimina; la composta sì', async () => {
      const { api, pollo } = await parti()
      const composed = await api.post('/recipes', {
        name: 'Cena',
        parts: [{ role: 'course', recipeId: pollo }],
      })
      const blocked = await api.delete(`/recipes/${pollo}`)
      expect(blocked.status).toBe(409)
      expect(blocked.body.error).toBe('recipe_in_use')
      expect((await api.delete(`/recipes/${composed.body.id}`)).status).toBe(204)
      expect((await api.delete(`/recipes/${pollo}`)).status).toBe(204)
    })
  })
})

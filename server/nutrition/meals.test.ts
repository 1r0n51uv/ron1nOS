// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { testDb } from '../testing/db.ts'
import { nutritionApp, resetNutrition, seedFood } from '../testing/nutrition.ts'
import { slotForHour } from './meals.ts'

let db: Awaited<ReturnType<typeof testDb>>
beforeAll(async () => {
  db = await testDb()
})
afterAll(() => db.drop())
beforeEach(() => resetNutrition(db))

const now = () => new Date('2026-10-21T10:30:00Z') // 12:30 a Roma

type Slot = {
  slot: string
  state: string
  meal: { kcal: number; items: { name: string; kcal: number }[] } | null
}
const slot = (body: { slots: Slot[] }, id: string) => body.slots.find((s) => s.slot === id)!

const fage = {
  source: 'openfoodfacts',
  externalId: '5201054017111',
  name: 'Yogurt greco bianco 2%',
  brand: 'Fage',
  barcode: '5201054017111',
  servingSizeG: 170,
  kcal: 73,
  protein: 9.9,
  carbs: 3,
  fat: 2,
  caffeineMg: null,
}

describe('POST /meals (NUT-003)', () => {
  it('registra più alimenti in uno slot e risponde con il giorno aggiornato', async () => {
    const avena = await seedFood(db, { name: "Fiocchi d'avena", kcal: 372, protein: 13, carbs: 60, fat: 7 })
    const api = nutritionApp(db, { now })
    const res = await api.post('/meals', {
      date: '2026-10-21',
      slot: 'breakfast',
      items: [
        { foodId: avena, grams: 50 },
        { food: fage, grams: 170 },
      ],
    })
    expect(res.status).toBe(201)
    const breakfast = slot(res.body, 'breakfast')
    expect(breakfast.state).toBe('eaten')
    expect(breakfast.meal?.items.map((i) => [i.name, i.kcal])).toEqual([
      ["Fiocchi d'avena", 186],
      ['Yogurt greco bianco 2% (Fage)', 124],
    ])
    expect(res.body.totals.kcal).toBe(310)
  })

  it('una seconda registrazione nello stesso slot si aggiunge in coda', async () => {
    const mela = await seedFood(db, { name: 'Mela', kcal: 52 })
    const api = nutritionApp(db, { now })
    await api.post('/meals', { date: '2026-10-20', slot: 'dinner', items: [{ foodId: mela, grams: 100 }] })
    const res = await api.post('/meals', {
      date: '2026-10-20',
      slot: 'dinner',
      items: [{ foodId: mela, grams: 200 }],
    })
    expect(res.body.date).toBe('2026-10-20')
    expect(slot(res.body, 'dinner').meal?.items.map((i) => i.kcal)).toEqual([52, 104])
  })

  it('un risultato esterno entra nel catalogo una volta sola', async () => {
    const api = nutritionApp(db, { now })
    for (let i = 0; i < 2; i++) {
      await api.post('/meals', { date: '2026-10-21', slot: 'lunch', items: [{ food: fage, grams: 100 }] })
    }
    const { rows } = await db.query('select name, source, external_id from foods')
    expect(rows).toEqual([
      { name: 'Yogurt greco bianco 2%', source: 'openfoodfacts', external_id: '5201054017111' },
    ])
  })

  it('kcal e macro sono copiati: correggere l’alimento non cambia lo storico', async () => {
    const pane = await seedFood(db, { name: 'Pane', kcal: 250, carbs: 50, caffeine: 0 })
    const api = nutritionApp(db, { now })
    await api.post('/meals', { date: '2026-10-21', slot: 'lunch', items: [{ foodId: pane, grams: 100 }] })
    await db.query('update foods set calories_per_100g = 999 where id = $1', [pane])
    const day = await api.get('/day?date=2026-10-21')
    expect(slot(day.body, 'lunch').meal?.kcal).toBe(250)
  })

  it('salva la caffeina della quantità', async () => {
    const caffe = await seedFood(db, { name: 'Caffè espresso', kcal: 2, caffeine: 212 })
    await nutritionApp(db, { now }).post('/meals', {
      date: '2026-10-21',
      slot: 'morning_snack',
      items: [{ foodId: caffe, grams: 30 }],
    })
    const { rows } = await db.query('select caffeine_mg from meal_entry_items')
    expect(rows[0].caffeine_mg).toBeCloseTo(63.6)
  })

  it('richieste non valide: 400; alimento sconosciuto: 404 e niente salvato', async () => {
    const api = nutritionApp(db, { now })
    const bad = [
      { date: '2026-10-21', slot: 'breakfast', items: [] },
      { date: '21/10/2026', slot: 'breakfast', items: [{ food: fage, grams: 100 }] },
      { date: '2026-10-21', slot: 'brunch', items: [{ food: fage, grams: 100 }] },
      { date: '2026-10-21', slot: 'breakfast', items: [{ food: fage, grams: 0 }] },
      { date: '2026-10-21', slot: 'breakfast', items: [{ food: { ...fage, kcal: 2000 }, grams: 10 }] },
    ]
    for (const body of bad) expect((await api.post('/meals', body)).status).toBe(400)

    const res = await api.post('/meals', {
      date: '2026-10-21',
      slot: 'breakfast',
      items: [
        { food: fage, grams: 100 },
        { foodId: '00000000-0000-4000-8000-000000000000', grams: 100 },
      ],
    })
    expect(res.status).toBe(404)
    const { rows } = await db.query('select count(*)::int as n from meal_entry_items')
    expect(rows[0]).toEqual({ n: 0 })
  })
})

describe('slot proposto', () => {
  it('segue l’ora del giorno', () => {
    expect([7, 10, 13, 16, 20].map(slotForHour)).toEqual([
      'breakfast',
      'morning_snack',
      'lunch',
      'afternoon_snack',
      'dinner',
    ])
  })

  it('GET /day lo propone solo per oggi', async () => {
    const api = nutritionApp(db, { now })
    expect((await api.get('/day')).body.suggestedSlot).toBe('lunch')
    expect((await api.get('/day?date=2026-10-20')).body.suggestedSlot).toBeNull()
  })
})

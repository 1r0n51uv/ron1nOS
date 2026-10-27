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

// I tempi di registrazione decidono l'ordine: nei test li scriviamo noi.
async function usedAt(itemId: string, when: string) {
  await db.query(`update meal_entry_items set created_at = $2 where id = $1`, [itemId, when])
}

const api = () => nutritionApp(db)

type Risultato = { id: string | null; name: string; source: string; kcal: number }
const nomi = (body: { results: Risultato[] }) => body.results.map((r) => r.name)

describe('alimenti recenti (NUT-028)', () => {
  it('senza pasti, nessun alimento', async () => {
    await seedFood(db, { name: 'Mela', kcal: 52 })
    expect((await api().get('/foods/recent')).body).toEqual({ results: [] })
  })

  it('dal più recente, senza doppioni', async () => {
    const pane = await seedFood(db, { name: 'Pane', kcal: 265 })
    const uova = await seedFood(db, { name: 'Uova', kcal: 155 })
    const riso = await seedFood(db, { name: 'Riso', kcal: 130 })
    const vecchio = await seedMeal(db, '2026-10-20', 'breakfast', [
      { foodId: pane, name: 'Pane', grams: 80, kcal: 212 },
      { foodId: riso, name: 'Riso', grams: 100, kcal: 130 },
    ])
    const nuovo = await seedMeal(db, '2026-10-27', 'lunch', [
      { foodId: uova, name: 'Uova', grams: 120, kcal: 186 },
      { foodId: pane, name: 'Pane', grams: 50, kcal: 132 },
    ])
    await usedAt(vecchio.itemIds[0], '2026-10-20T07:00:00Z')
    await usedAt(vecchio.itemIds[1], '2026-10-20T07:01:00Z')
    await usedAt(nuovo.itemIds[0], '2026-10-27T12:00:00Z')
    await usedAt(nuovo.itemIds[1], '2026-10-27T12:01:00Z')
    const res = await api().get('/foods/recent')
    expect(res.status).toBe(200)
    // Il pane è stato usato due volte: conta l'ultima e compare una volta.
    expect(nomi(res.body)).toEqual(['Pane', 'Uova', 'Riso'])
    expect(res.body.results[0]).toMatchObject({ id: pane, source: 'custom', kcal: 265 })
  })

  it('con uno slot, prima quelli usati in quello slot', async () => {
    const caffe = await seedFood(db, { name: 'Caffè', kcal: 2 })
    const pollo = await seedFood(db, { name: 'Pollo', kcal: 165 })
    const colazione = await seedMeal(db, '2026-10-20', 'breakfast', [
      { foodId: caffe, name: 'Caffè', grams: 30, kcal: 1 },
    ])
    const pranzo = await seedMeal(db, '2026-10-27', 'lunch', [
      { foodId: pollo, name: 'Pollo', grams: 200, kcal: 330 },
    ])
    await usedAt(colazione.itemIds[0], '2026-10-20T07:00:00Z')
    await usedAt(pranzo.itemIds[0], '2026-10-27T12:00:00Z')
    expect(nomi((await api().get('/foods/recent')).body)).toEqual(['Pollo', 'Caffè'])
    expect(nomi((await api().get('/foods/recent?slot=breakfast')).body)).toEqual(['Caffè', 'Pollo'])
  })

  it('al massimo 12', async () => {
    const items = []
    for (let i = 0; i < 15; i++) {
      const id = await seedFood(db, { name: `Alimento ${i}`, kcal: 100 + i })
      items.push({ foodId: id, name: `Alimento ${i}`, grams: 100, kcal: 100 })
    }
    const pasto = await seedMeal(db, '2026-10-27', 'dinner', items)
    for (const [i, id] of pasto.itemIds.entries()) {
      await usedAt(id, `2026-10-27T12:${String(i).padStart(2, '0')}:00Z`)
    }
    const res = await api().get('/foods/recent')
    expect(res.body.results).toHaveLength(12)
    expect(nomi(res.body)[0]).toBe('Alimento 14')
  })

  it('uno slot sconosciuto è una richiesta non valida', async () => {
    const res = await api().get('/foods/recent?slot=brunch')
    expect(res.status).toBe(400)
  })
})

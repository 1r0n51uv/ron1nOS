import { describe, expect, it } from 'vitest'

import type { Food, Recipe } from '../data'
import { rowFromFood, rowsFromRecipe, rowsTotal, toRecipeInput } from './editor'

const food = (over: Partial<Food>): Food => ({
  id: 'f1',
  source: 'custom',
  externalId: null,
  name: 'Riso',
  brand: null,
  barcode: null,
  servingSizeG: null,
  kcal: 350,
  protein: 7,
  carbs: 78,
  fat: 0.6,
  caffeineMg: null,
  yazioProductId: null,
  ...over,
})

describe('editor delle ricette', () => {
  it('totali dalle righe, per id o esterne', () => {
    const rows = [
      rowFromFood(food({}), 80),
      rowFromFood(food({ id: null, source: 'usda', externalId: '9', kcal: 100 }), 50),
    ]
    expect(rowsTotal(rows).kcal).toBe(330)
    expect(toRecipeInput(' Pranzo ', '  ', rows)).toEqual({
      name: 'Pranzo',
      notes: null,
      items: [
        { foodId: 'f1', grams: 80 },
        { food: expect.objectContaining({ externalId: '9' }), grams: 50 },
      ],
    })
  })

  it('senza nome o alimenti non si salva', () => {
    expect(toRecipeInput('', '', [rowFromFood(food({}), 80)])).toBeNull()
    expect(toRecipeInput('Pranzo', '', [])).toBeNull()
  })

  it('da una ricetta salvata: valori per 100 g, senza gli alimenti eliminati', () => {
    const recipe: Recipe = {
      id: 'r1',
      name: 'Pranzo',
      notes: null,
      grams: 230,
      kcal: 445,
      protein: 40,
      carbs: 62,
      fat: 2,
      items: [
        {
          id: 'i1',
          foodId: 'f1',
          name: 'Riso',
          grams: 80,
          kcal: 280,
          protein: 5.6,
          carbs: 62,
          fat: 0.5,
          missing: false,
        },
        {
          id: 'i2',
          foodId: null,
          name: 'Pollo',
          grams: 150,
          kcal: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          missing: true,
        },
      ],
    }
    const rows = rowsFromRecipe(recipe)
    expect(rows).toHaveLength(1)
    expect(rows[0].per100.kcal).toBe(350)
  })
})

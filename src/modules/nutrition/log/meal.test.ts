import { describe, expect, it } from 'vitest'

import type { Food } from '../data'
import { defaultGrams, macrosOf, parseGrams, toItem, totalOf } from './meal'

const food: Food = {
  id: null,
  source: 'usda',
  externalId: '1',
  name: 'Apples, raw',
  brand: null,
  barcode: null,
  servingSizeG: null,
  kcal: 52,
  protein: 0.3,
  carbs: 14,
  fat: 0.2,
  caffeineMg: null,
  yazioProductId: null,
}

describe('meal', () => {
  it('macro di una quantità e totale', () => {
    expect(macrosOf(food, 200)).toEqual({ kcal: 104, protein: 0.6, carbs: 28, fat: 0.4 })
    expect(
      totalOf([
        { food, grams: 100 },
        { food, grams: 100 },
      ]).kcal,
    ).toBe(104)
  })

  it('grammi: virgola, positivi, entro 10 kg', () => {
    expect(parseGrams('12,5')).toBe(12.5)
    expect(['', '0', '-3', 'abc', '20000'].map(parseGrams)).toEqual([null, null, null, null, null])
  })

  it('quantità proposta e forma della richiesta', () => {
    expect(defaultGrams(food)).toBe(100)
    expect(defaultGrams({ ...food, servingSizeG: 30 })).toBe(30)
    expect(toItem({ food: { ...food, id: 'f1' }, grams: 10 })).toEqual({ foodId: 'f1', grams: 10 })
    expect(toItem({ food, grams: 10 })).toEqual({
      food: expect.not.objectContaining({ id: null }),
      grams: 10,
    })
  })
})

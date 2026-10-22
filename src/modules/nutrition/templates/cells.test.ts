import { describe, expect, it } from 'vitest'

import type { Template } from '../data'
import { renamed, withCell } from './cells'

const t: Template = {
  id: 't1',
  name: 'Definizione',
  dayKcal: [539, 0, 0, 0, 0, 0, 0],
  cells: [
    { weekday: 1, slot: 'lunch', recipeId: 'r1', foodId: null, grams: null, name: 'Riso e pollo', kcal: 445 },
    { weekday: 1, slot: 'morning_snack', recipeId: null, foodId: 'f1', grams: 180, name: 'Mela', kcal: 94 },
  ],
}

describe('celle del template', () => {
  it('cambia o svuota una cella, tiene le altre', () => {
    expect(
      withCell(t, { weekday: 1, slot: 'lunch' }, { weekday: 1, slot: 'lunch', foodId: 'f2', grams: 100 }),
    ).toEqual({
      name: 'Definizione',
      cells: [
        { weekday: 1, slot: 'morning_snack', foodId: 'f1', grams: 180 },
        { weekday: 1, slot: 'lunch', foodId: 'f2', grams: 100 },
      ],
    })
    expect(withCell(t, { weekday: 1, slot: 'morning_snack' }, null).cells).toEqual([
      { weekday: 1, slot: 'lunch', recipeId: 'r1' },
    ])
  })

  it('rinomina senza toccare la griglia', () => {
    expect(renamed(t, 'Massa')).toEqual({
      name: 'Massa',
      cells: [
        { weekday: 1, slot: 'lunch', recipeId: 'r1' },
        { weekday: 1, slot: 'morning_snack', foodId: 'f1', grams: 180 },
      ],
    })
  })
})

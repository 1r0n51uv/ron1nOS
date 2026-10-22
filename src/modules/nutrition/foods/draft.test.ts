import { describe, expect, it } from 'vitest'

import { toFoodDraft, toFoodInput } from './draft'

const base = { ...toFoodDraft(), name: ' Granola ', kcal: '450', protein: '10', carbs: '60,5', fat: '18' }

describe('modulo alimento personale', () => {
  it('i facoltativi vuoti diventano null, la virgola vale punto', () => {
    expect(toFoodInput(base)).toEqual({
      name: 'Granola',
      brand: null,
      barcode: null,
      servingSizeG: null,
      kcal: 450,
      protein: 10,
      carbs: 60.5,
      fat: 18,
      caffeineMg: null,
    })
  })

  it('rifiuta valori fuori scala o mancanti', () => {
    for (const over of [
      { name: '' },
      { kcal: '' },
      { kcal: '901' },
      { fat: '101' },
      { barcode: '12a' },
      { servingSizeG: '-1' },
    ]) {
      expect(toFoodInput({ ...base, ...over })).toBeNull()
    }
  })

  it('riparte dai valori di un alimento', () => {
    expect(toFoodDraft({ name: 'Mela', kcal: 52, brand: null })).toMatchObject({
      name: 'Mela',
      kcal: '52',
      brand: '',
    })
  })
})

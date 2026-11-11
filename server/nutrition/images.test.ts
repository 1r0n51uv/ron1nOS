// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { recipeImage } from './images.ts'

describe('foto di una ricetta (NUT-034)', () => {
  it('usa la versione ridimensionata del CDN di YAZIO', () => {
    expect(recipeImage('https://images.yazio.com/app/recipe/yazio/recipe-243.jpg')).toBe(
      'https://images.yazio-cdn.com/process/w:684/h:558/rt:fill/f:webp/plain/app/recipe/yazio/recipe-243.jpg',
    )
  })

  it("lascia com'è un indirizzo che non è di YAZIO", () => {
    expect(recipeImage('https://esempio.it/foto.jpg')).toBe('https://esempio.it/foto.jpg')
  })

  it.each([null, undefined, ''])('senza foto (%s) è null', (url) => {
    expect(recipeImage(url)).toBeNull()
  })
})

import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/test/render'
import type * as data from '../data'
import type { BarcodeResult, Food } from '../data'
import { useBarcode } from '../data'
import { BarcodeTab } from './BarcodeTab'

vi.mock('../data', async (importOriginal) => ({
  ...(await importOriginal<typeof data>()),
  useBarcode: vi.fn(),
}))

const fage: Food = {
  id: null,
  source: 'openfoodfacts',
  externalId: '5201054017111',
  name: 'Yogurt greco bianco 2%',
  brand: 'Fage',
  barcode: '5201054017111',
  servingSizeG: 170,
  kcal: 73,
  protein: 10,
  carbs: 3.9,
  fat: 2,
  caffeineMg: null,
  yazioProductId: null,
}

let result: BarcodeResult | undefined
beforeEach(() => {
  result = undefined
  vi.mocked(useBarcode).mockImplementation(
    (code) => ({ data: code ? result : undefined, error: null, isFetching: false }) as never,
  )
})

function setup() {
  const onPick = vi.fn()
  const onCreate = vi.fn()
  renderWithProviders(<BarcodeTab onPick={onPick} onCreate={onCreate} />)
  const search = (code: string) => {
    fireEvent.change(screen.getByLabelText('Codice a barre'), { target: { value: code } })
    fireEvent.click(screen.getByRole('button', { name: 'Cerca' }))
  }
  return { onPick, onCreate, search }
}

describe('BarcodeTab (NUT-005)', () => {
  it('accetta solo da 6 a 14 cifre, spazi esclusi', () => {
    setup()
    fireEvent.change(screen.getByLabelText('Codice a barre'), { target: { value: '12a45' } })
    expect(screen.getByRole('button', { name: 'Cerca' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Codice a barre'), { target: { value: '5201 0540 17111' } })
    expect(screen.getByRole('button', { name: 'Cerca' })).toBeEnabled()
  })

  it('un codice trovato diventa l’alimento scelto', () => {
    result = { food: fage, unavailable: [] }
    const { onPick, search } = setup()
    search('5201 054017111')
    expect(vi.mocked(useBarcode)).toHaveBeenLastCalledWith('5201054017111')
    expect(onPick).toHaveBeenCalledWith(fage)
  })

  it('codice sconosciuto: propone di creare l’alimento', () => {
    result = { food: null, unavailable: [] }
    const { onCreate, search } = setup()
    search('80012345')
    expect(screen.getByText('80012345')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: "Crea l'alimento" }))
    expect(onCreate).toHaveBeenCalledWith('80012345')
  })

  it('OpenFoodFacts giù: lo dice', () => {
    result = { food: null, unavailable: ['openfoodfacts'] }
    setup().search('80012345')
    expect(screen.getByText('OpenFoodFacts non risponde.')).toBeInTheDocument()
  })
})

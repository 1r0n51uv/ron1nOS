import { fireEvent, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/test/render'
import type * as data from '../data'
import type { Food, Unmatched } from '../data'
import { useSetEquivalent, useUnmatched, useYazioProducts } from '../data'
import { todayRome } from '../dates'
import { UnmatchedPanel } from './UnmatchedPanel'

vi.mock('../data', async (importOriginal) => ({
  ...(await importOriginal<typeof data>()),
  useUnmatched: vi.fn(),
  useYazioProducts: vi.fn(),
  useSetEquivalent: vi.fn(),
}))

const grissini: Unmatched = {
  food: { id: 'f1', name: 'Grissini torinesi', brand: null, source: 'openfoodfacts', kcal: 410 },
  rows: 1,
  last: { day: todayRome(), slot: 'morning_snack', grams: 20 },
}

const product = (over: Partial<Food>): Food => ({
  id: null,
  source: 'yazio',
  externalId: 'p1',
  name: 'Grissini classici',
  brand: null,
  barcode: null,
  servingSizeG: null,
  kcal: 412,
  protein: 12,
  carbs: 70,
  fat: 8.5,
  caffeineMg: null,
  yazioProductId: 'p1',
  ...over,
})

const match = vi.fn()

beforeEach(() => {
  match.mockReset()
  vi.mocked(useUnmatched).mockReturnValue({ data: { foods: [grissini] } } as never)
  vi.mocked(useSetEquivalent).mockReturnValue({ mutate: match, isPending: false, error: null } as never)
  vi.mocked(useYazioProducts).mockReturnValue({
    data: {
      products: [
        product({}),
        product({ yazioProductId: 'p2', externalId: 'p2', name: 'Grissini integrali', kcal: 389 }),
      ],
    },
    error: null,
  } as never)
})

describe('UnmatchedPanel (NUT-023)', () => {
  it('senza alimenti da abbinare non si vede', () => {
    vi.mocked(useUnmatched).mockReturnValue({ data: { foods: [] } } as never)
    renderWithProviders(<UnmatchedPanel />)
    expect(screen.queryByRole('region', { name: 'Senza equivalente' })).not.toBeInTheDocument()
  })

  it('mostra l’alimento e dove è stato usato', () => {
    renderWithProviders(<UnmatchedPanel />)
    const row = screen.getByRole('listitem', { name: 'Grissini torinesi' })
    expect(row).toHaveTextContent('OpenFoodFacts · 410 kcal / 100 g · usato oggi a Spuntino, 20 g')
  })

  it('si cerca in YAZIO, si sceglie e si abbina, con la differenza di kcal', () => {
    renderWithProviders(<UnmatchedPanel />)
    const row = within(screen.getByRole('listitem', { name: 'Grissini torinesi' }))
    fireEvent.click(row.getByRole('button', { name: 'Cerca in YAZIO' }))
    expect(row.getByRole('button', { name: 'Abbina e invia' })).toBeDisabled()
    fireEvent.click(row.getByRole('radio', { name: /Grissini classici/ }))
    expect(row.getByText(/Differenza con l’alimento registrato/)).toHaveTextContent('+2 kcal / 100 g')
    fireEvent.click(row.getByRole('button', { name: 'Abbina e invia' }))
    expect(match).toHaveBeenCalledWith({ foodId: 'f1', productId: 'p1' })
  })

  it('Lascia solo in ron1nOS', () => {
    renderWithProviders(<UnmatchedPanel />)
    fireEvent.click(screen.getByRole('button', { name: 'Lascia solo in ron1nOS' }))
    expect(match).toHaveBeenCalledWith({ foodId: 'f1', productId: null })
  })
})

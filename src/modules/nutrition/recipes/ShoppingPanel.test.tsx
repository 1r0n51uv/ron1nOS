import { fireEvent, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/test/render'
import type * as data from '../data'
import type { ShoppingItem } from '../data'
import {
  useAddShopping,
  useClearChecked,
  useDeleteShopping,
  useGenerateShopping,
  useShopping,
  useToggleShopping,
} from '../data'
import { ShoppingPanel } from './ShoppingPanel'

vi.mock('../data', async (importOriginal) => ({
  ...(await importOriginal<typeof data>()),
  useShopping: vi.fn(),
  useGenerateShopping: vi.fn(),
  useAddShopping: vi.fn(),
  useToggleShopping: vi.fn(),
  useDeleteShopping: vi.fn(),
  useClearChecked: vi.fn(),
}))

const item = (over: Partial<ShoppingItem>): ShoppingItem => ({
  id: 'x',
  foodId: null,
  name: 'X',
  grams: null,
  text: null,
  checked: false,
  source: 'manual',
  ...over,
})

const mocks = {
  generate: vi.fn(),
  add: vi.fn(),
  toggle: vi.fn(),
  remove: vi.fn(),
  clear: vi.fn(),
}
let generated: unknown
beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockReset())
  generated = undefined
  const m = (mutate: unknown, extra = {}) => ({ mutate, isPending: false, error: null, ...extra }) as never
  vi.mocked(useShopping).mockReturnValue({
    data: {
      items: [
        item({ id: 'g1', name: 'Petto di pollo', grams: 450, source: 'generated', checked: true }),
        item({ id: 'g2', name: 'Riso basmati', grams: 240, source: 'generated' }),
        item({ id: 'm1', name: 'Caffè macinato', text: '1 pacco' }),
      ],
    },
    error: null,
  } as never)
  vi.mocked(useGenerateShopping).mockImplementation(() => m(mocks.generate, { data: generated }))
  vi.mocked(useAddShopping).mockReturnValue(m(mocks.add))
  vi.mocked(useToggleShopping).mockReturnValue(m(mocks.toggle))
  vi.mocked(useDeleteShopping).mockReturnValue(m(mocks.remove))
  vi.mocked(useClearChecked).mockReturnValue(m(mocks.clear))
})

describe('ShoppingPanel (NUT-011)', () => {
  it('voci dal piano e a mano, con le spuntate contate', () => {
    renderWithProviders(<ShoppingPanel />)
    expect(screen.getByText('1 di 3')).toBeInTheDocument()
    const plan = screen.getByRole('list', { name: 'Dal piano' })
    expect(within(plan).getByText('450 g')).toBeInTheDocument()
    expect(within(plan).getByRole('checkbox', { name: 'Petto di pollo' })).toBeChecked()
    expect(
      within(screen.getByRole('list', { name: 'Aggiunte a mano' })).getByText('1 pacco'),
    ).toBeInTheDocument()
  })

  it('genera dalla settimana scelta, da lunedì a domenica', () => {
    renderWithProviders(<ShoppingPanel />)
    fireEvent.click(screen.getByRole('button', { name: 'Genera' }))
    const { from, to } = mocks.generate.mock.calls[0][0]
    expect(new Date(`${from}T12:00:00Z`).getUTCDay()).toBe(1)
    expect(new Date(`${to}T12:00:00Z`).getUTCDay()).toBe(0)
  })

  it('dice quante voci ha aggiunto', () => {
    generated = { added: 0, items: [] }
    renderWithProviders(<ShoppingPanel />)
    expect(screen.getByText('Niente da aggiungere.')).toBeInTheDocument()
  })

  it('spunta, elimina, aggiunge e toglie le spuntate', () => {
    renderWithProviders(<ShoppingPanel />)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Riso basmati' }))
    expect(mocks.toggle).toHaveBeenCalledWith({ id: 'g2', checked: true })
    fireEvent.click(screen.getByRole('button', { name: 'Elimina Caffè macinato' }))
    expect(mocks.remove).toHaveBeenCalledWith('m1')
    fireEvent.change(screen.getByLabelText('Voce'), { target: { value: 'Limoni' } })
    fireEvent.click(screen.getByRole('button', { name: 'Aggiungi' }))
    expect(mocks.add.mock.calls[0][0]).toEqual({ name: 'Limoni', text: null })
    fireEvent.click(screen.getByRole('button', { name: 'Togli le spuntate' }))
    expect(mocks.clear).toHaveBeenCalled()
  })
})

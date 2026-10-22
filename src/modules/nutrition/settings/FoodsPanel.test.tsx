import { fireEvent, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/test/render'
import type * as data from '../data'
import type { Food } from '../data'
import { useCreateFood, useCustomFoods, useDeleteFood, useUpdateFood } from '../data'
import { FoodsPanel } from './FoodsPanel'

vi.mock('../data', async (importOriginal) => ({
  ...(await importOriginal<typeof data>()),
  useCustomFoods: vi.fn(),
  useCreateFood: vi.fn(),
  useUpdateFood: vi.fn(),
  useDeleteFood: vi.fn(),
}))

const granola: Food = {
  id: 'f1',
  source: 'custom',
  externalId: null,
  name: 'Granola della casa',
  brand: 'Forno Rossi',
  barcode: null,
  servingSizeG: 40,
  kcal: 450,
  protein: 10,
  carbs: 60,
  fat: 18,
  caffeineMg: null,
  yazioProductId: null,
}

const create = vi.fn()
const update = vi.fn()
const remove = vi.fn()
const mutation = (mutate: unknown) => ({ mutate, isPending: false, error: null }) as never

beforeEach(() => {
  for (const m of [create, update, remove]) m.mockReset()
  vi.mocked(useCreateFood).mockReturnValue(mutation(create))
  vi.mocked(useUpdateFood).mockReturnValue(mutation(update))
  vi.mocked(useDeleteFood).mockReturnValue(mutation(remove))
  vi.mocked(useCustomFoods).mockReturnValue({ data: { foods: [granola] }, error: null } as never)
})

describe('FoodsPanel (NUT-006)', () => {
  it('elenca gli alimenti con i valori per 100 g', () => {
    renderWithProviders(<FoodsPanel />)
    const row = screen.getByRole('listitem', { name: 'Granola della casa' })
    expect(within(row).getByText('450 kcal · P 10,0 · C 60,0 · G 18,0')).toBeInTheDocument()
    expect(screen.getByText('1 alimento')).toBeInTheDocument()
  })

  it('crea un alimento con i soli campi obbligatori', () => {
    renderWithProviders(<FoodsPanel />)
    fireEvent.click(screen.getByRole('button', { name: 'Nuovo alimento' }))
    const form = screen.getByRole('form', { name: 'Alimento personale' })
    const create$ = within(form).getByRole('button', { name: 'Crea' })
    expect(create$).toBeDisabled()
    fireEvent.change(within(form).getByLabelText('Nome'), { target: { value: 'Barretta' } })
    for (const [label, v] of [
      ['Calorie', '380'],
      ['Proteine', '20'],
      ['Carboidrati', '40'],
      ['Grassi', '12'],
    ]) {
      fireEvent.change(within(form).getByLabelText(label), { target: { value: v } })
    }
    fireEvent.click(create$)
    expect(create.mock.calls[0][0]).toEqual({
      name: 'Barretta',
      brand: null,
      barcode: null,
      servingSizeG: null,
      kcal: 380,
      protein: 20,
      carbs: 40,
      fat: 12,
      caffeineMg: null,
    })
  })

  it('modifica con i valori di partenza', () => {
    renderWithProviders(<FoodsPanel />)
    fireEvent.click(screen.getByRole('button', { name: 'Modifica' }))
    const form = screen.getByRole('form', { name: 'Alimento personale' })
    expect(within(form).getByLabelText(/Marca/)).toHaveValue('Forno Rossi')
    fireEvent.change(within(form).getByLabelText('Calorie'), { target: { value: '400' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Salva' }))
    expect(update.mock.calls[0][0]).toMatchObject({ id: 'f1', input: { kcal: 400, servingSizeG: 40 } })
  })

  it('elimina dopo la conferma', () => {
    renderWithProviders(<FoodsPanel />)
    fireEvent.click(screen.getByRole('button', { name: 'Elimina' }))
    expect(remove).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Elimina davvero' }))
    expect(remove).toHaveBeenCalledWith('f1')
  })

  it('senza alimenti lo dice', () => {
    vi.mocked(useCustomFoods).mockReturnValue({ data: { foods: [] }, error: null } as never)
    renderWithProviders(<FoodsPanel />)
    expect(screen.getByText('Nessun alimento personale.')).toBeInTheDocument()
  })
})

import { act, fireEvent, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api'
import { renderWithProviders } from '@/test/render'
import type * as data from '../data'
import type { Food } from '../data'
import { useCreateFood, useFoodSearch, useLogMeal, useRecipes } from '../data'
import { AddMealDialog } from './AddMealDialog'

vi.mock('../data', async (importOriginal) => ({
  ...(await importOriginal<typeof data>()),
  useFoodSearch: vi.fn(),
  useLogMeal: vi.fn(),
  useCreateFood: vi.fn(),
  useRecipes: vi.fn(),
}))

const food = (over: Partial<Food>): Food => ({
  id: null,
  source: 'openfoodfacts',
  externalId: 'x',
  name: 'X',
  brand: null,
  barcode: null,
  servingSizeG: null,
  kcal: 100,
  protein: 0,
  carbs: 0,
  fat: 0,
  caffeineMg: null,
  yazioProductId: null,
  ...over,
})

const avena = food({
  id: 'f1',
  source: 'custom',
  externalId: null,
  name: "Fiocchi d'avena",
  kcal: 372,
  protein: 13,
})
const fage = food({
  externalId: '520',
  name: 'Yogurt greco bianco 2%',
  brand: 'Fage',
  servingSizeG: 170,
  kcal: 73,
})

const mutate = vi.fn()
const createFood = vi.fn()
let logError: unknown = null
beforeEach(() => {
  mutate.mockReset()
  createFood.mockReset()
  logError = null
  vi.mocked(useRecipes).mockReturnValue({
    data: {
      recipes: [
        {
          id: 'r1',
          name: 'Riso, pollo e zucchine',
          notes: null,
          grams: 430,
          kcal: 479,
          protein: 42.5,
          carbs: 68,
          fat: 4,
          items: [],
        },
      ],
    },
    error: null,
  } as never)
  vi.mocked(useCreateFood).mockReturnValue({ mutate: createFood, isPending: false, error: null } as never)
  vi.mocked(useLogMeal).mockImplementation(
    () => ({ mutate, isPending: false, error: logError }) as unknown as ReturnType<typeof useLogMeal>,
  )
  vi.mocked(useFoodSearch).mockImplementation(
    (q: string) =>
      ({
        data: q.trim().length >= 2 ? { results: [avena, fage], unavailable: ['usda'] } : undefined,
        error: null,
        isFetching: false,
      }) as unknown as ReturnType<typeof useFoodSearch>,
  )
})

function open(slot: data.SlotId = 'lunch') {
  renderWithProviders(
    <AddMealDialog date="2026-10-21" slot={slot}>
      <Button>Apri</Button>
    </AddMealDialog>,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Apri' }))
  return screen.getByRole('dialog')
}

describe('AddMealDialog (NUT-003)', () => {
  it('parte dallo slot scelto, con il giorno nel titolo', () => {
    const dialog = open('lunch')
    expect(within(dialog).getByText('REGISTRA · MERCOLEDÌ 21 OTTOBRE')).toBeInTheDocument()
    expect(within(dialog).getByRole('radio', { name: 'Pranzo' })).toHaveAttribute('aria-checked', 'true')
    expect(within(dialog).getByRole('button', { name: 'Registra' })).toBeDisabled()
  })

  it('cerca, sceglie la quantità e registra più alimenti', async () => {
    const dialog = open('lunch')
    fireEvent.change(within(dialog).getByLabelText('Cerca un alimento'), { target: { value: 'yo' } })
    const list = await within(dialog).findByRole('list', { name: 'Risultati' })
    expect(within(dialog).getByText('Non risponde: USDA')).toBeInTheDocument()

    // La porzione dell'alimento è la quantità proposta.
    fireEvent.click(within(list).getByRole('button', { name: /Yogurt greco bianco 2%/ }))
    expect(within(dialog).getByLabelText('Quantità in grammi')).toHaveValue(170)
    expect(within(dialog).getByText('124 kcal · P 0 · C 0 · G 0')).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Aggiungi' }))

    fireEvent.click(within(list).getByRole('button', { name: /Fiocchi d'avena/ }))
    fireEvent.change(within(dialog).getByLabelText('Quantità in grammi'), { target: { value: '50' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Aggiungi' }))

    const meal = within(dialog).getByRole('list', { name: 'Nel pasto' })
    expect(within(meal).getAllByRole('listitem')).toHaveLength(2)
    expect(within(dialog).getByText('310 kcal · P 7 · C 0 · G 0')).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('radio', { name: 'Cena' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Registra' }))
    expect(mutate.mock.calls[0][0]).toEqual({
      date: '2026-10-21',
      slot: 'dinner',
      items: [
        { food: expect.objectContaining({ name: 'Yogurt greco bianco 2%', externalId: '520' }), grams: 170 },
        { foodId: 'f1', grams: 50 },
      ],
    })
    expect(mutate.mock.calls[0][0].items[0].food).not.toHaveProperty('id')
  })

  it('una riga si toglie prima di registrare', async () => {
    const dialog = open()
    fireEvent.change(within(dialog).getByLabelText('Cerca un alimento'), { target: { value: 'avena' } })
    fireEvent.click(await within(dialog).findByRole('button', { name: /Fiocchi d'avena/ }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Aggiungi' }))
    fireEvent.click(within(dialog).getByRole('button', { name: "Togli Fiocchi d'avena" }))
    expect(within(dialog).queryByRole('list', { name: 'Nel pasto' })).not.toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Registra' })).toBeDisabled()
  })

  it('quantità non valida: Aggiungi spento', async () => {
    const dialog = open()
    fireEvent.change(within(dialog).getByLabelText('Cerca un alimento'), { target: { value: 'avena' } })
    fireEvent.click(await within(dialog).findByRole('button', { name: /Fiocchi d'avena/ }))
    fireEvent.change(within(dialog).getByLabelText('Quantità in grammi'), { target: { value: '0' } })
    expect(within(dialog).getByRole('button', { name: 'Aggiungi' })).toBeDisabled()
  })

  it('mostra l’errore del backend', () => {
    logError = new ApiError('database_unavailable', 'Database non disponibile', 503)
    const dialog = open()
    expect(within(dialog).getByText('Pasto non registrato.')).toBeInTheDocument()
    expect(within(dialog).getByText('Database non disponibile')).toBeInTheDocument()
  })

  it('Nuovo alimento: lo crea e lo sceglie, col nome della ricerca', async () => {
    const dialog = open()
    fireEvent.change(within(dialog).getByLabelText('Cerca un alimento'), { target: { value: 'granola' } })
    fireEvent.mouseDown(within(dialog).getByRole('tab', { name: 'Nuovo alimento' }))
    const form = within(dialog).getByRole('form', { name: 'Alimento personale' })
    expect(within(form).getByLabelText('Nome')).toHaveValue('granola')
    for (const [label, v] of [
      ['Calorie', '450'],
      ['Proteine', '10'],
      ['Carboidrati', '60'],
      ['Grassi', '18'],
      [/Porzione/, '40'],
    ] as const) {
      fireEvent.change(within(form).getByLabelText(label), { target: { value: v } })
    }
    fireEvent.click(within(form).getByRole('button', { name: 'Crea e scegli' }))
    expect(createFood.mock.calls[0][0]).toMatchObject({ name: 'granola', kcal: 450, servingSizeG: 40 })

    const created = food({ id: 'f9', source: 'custom', name: 'granola', kcal: 450, servingSizeG: 40 })
    act(() => createFood.mock.calls[0][1].onSuccess(created))
    expect(within(dialog).getByRole('tab', { name: 'Cerca' })).toHaveAttribute('aria-selected', 'true')
    expect(within(dialog).getByRole('group', { name: 'Alimento scelto' })).toHaveTextContent('granola')
    expect(within(dialog).getByLabelText('Quantità in grammi')).toHaveValue(40)
  })

  it('Ricetta: entra nel pasto in un colpo', () => {
    const dialog = open('lunch')
    fireEvent.mouseDown(within(dialog).getByRole('tab', { name: 'Ricetta' }))
    fireEvent.click(within(dialog).getByRole('button', { name: /Riso, pollo e zucchine/ }))
    const meal = within(dialog).getByRole('list', { name: 'Nel pasto' })
    expect(within(meal).getByText('ricetta')).toBeInTheDocument()
    expect(within(dialog).getByText('479 kcal · P 43 · C 68 · G 4')).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Registra' }))
    expect(mutate.mock.calls[0][0].items).toEqual([{ recipeId: 'r1', factor: 1 }])
  })
})

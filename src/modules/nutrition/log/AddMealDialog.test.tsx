import { fireEvent, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api'
import { renderWithProviders } from '@/test/render'
import type * as data from '../data'
import type { Food } from '../data'
import { useFoodSearch, useLogMeal } from '../data'
import { AddMealDialog } from './AddMealDialog'

vi.mock('../data', async (importOriginal) => ({
  ...(await importOriginal<typeof data>()),
  useFoodSearch: vi.fn(),
  useLogMeal: vi.fn(),
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
let logError: unknown = null
beforeEach(() => {
  mutate.mockReset()
  logError = null
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
})

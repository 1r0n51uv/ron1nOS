import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api'
import { renderWithProviders } from '@/test/render'
import type * as data from '../data'
import type { MealItem } from '../data'
import { useRemoveItem, useSetGrams } from '../data'
import { ItemRow } from './ItemRow'

vi.mock('../data', async (importOriginal) => ({
  ...(await importOriginal<typeof data>()),
  useRemoveItem: vi.fn(),
  useSetGrams: vi.fn(),
}))

const item: MealItem = {
  id: 'i1',
  foodId: 'f1',
  name: 'Mela',
  grams: 180,
  kcal: 94,
  protein: 0.5,
  carbs: 25,
  fat: 0.3,
  origin: 'ron1nos',
  sync: 'local',
}

const save = vi.fn()
const remove = vi.fn()
let saveError: unknown = null
beforeEach(() => {
  save.mockReset()
  remove.mockReset()
  saveError = null
  vi.mocked(useSetGrams).mockImplementation(
    () => ({ mutate: save, reset: vi.fn(), isPending: false, error: saveError }) as never,
  )
  vi.mocked(useRemoveItem).mockReturnValue({ mutate: remove, isPending: false, error: null } as never)
})

const row = () =>
  renderWithProviders(
    <ul>
      <ItemRow item={item} />
    </ul>,
  )

describe('ItemRow (NUT-007)', () => {
  it('ogni riga dice il suo stato verso YAZIO (NUT-023)', () => {
    for (const [sync, label] of [
      ['pending', 'in coda'],
      ['synced', 'inviata'],
      ['error', 'errore'],
      ['unmatched', 'senza equivalente'],
    ] as const) {
      const { unmount } = renderWithProviders(<ItemRow item={{ ...item, sync }} />)
      expect(screen.getByText(label)).toBeInTheDocument()
      unmount()
    }
    renderWithProviders(<ItemRow item={item} />)
    expect(screen.queryByText('in coda')).not.toBeInTheDocument()
  })

  it('una voce letta da YAZIO lo dice (NUT-022)', () => {
    renderWithProviders(<ItemRow item={{ ...item, origin: 'yazio', sync: 'synced' }} />)
    expect(screen.getByRole('listitem')).toHaveTextContent('Mela · da YAZIO')
  })

  it('toglie la riga', () => {
    row()
    fireEvent.click(screen.getByRole('button', { name: 'Togli Mela' }))
    expect(remove).toHaveBeenCalledWith('i1')
  })

  it('cambia i grammi con Invio, Esc annulla', () => {
    row()
    fireEvent.click(screen.getByRole('button', { name: 'Cambia i grammi di Mela' }))
    const input = screen.getByLabelText('Grammi di Mela')
    expect(input).toHaveValue(180)
    fireEvent.change(input, { target: { value: '120' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(save.mock.calls[0][0]).toEqual({ id: 'i1', grams: 120 })

    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByLabelText('Grammi di Mela')).not.toBeInTheDocument()
    expect(screen.getByText('180 g')).toBeInTheDocument()
  })

  it('grammi uguali o non validi: niente salvataggio', () => {
    row()
    fireEvent.click(screen.getByRole('button', { name: 'Cambia i grammi di Mela' }))
    const input = screen.getByLabelText('Grammi di Mela')
    fireEvent.change(input, { target: { value: '0' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.change(input, { target: { value: '180' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(save).not.toHaveBeenCalled()
    expect(screen.queryByLabelText('Grammi di Mela')).not.toBeInTheDocument()
  })

  it('mostra l’errore del backend', () => {
    saveError = new ApiError('not_found', 'Riga del pasto non trovata', 404)
    row()
    expect(screen.getByText('Riga del pasto non trovata')).toBeInTheDocument()
  })
})

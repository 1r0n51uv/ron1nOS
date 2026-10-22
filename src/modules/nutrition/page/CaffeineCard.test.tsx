import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/test/render'
import type * as data from '../data'
import type { Day } from '../data'
import { useAddCaffeine, useUndoCaffeine } from '../data'
import { CaffeineCard } from './CaffeineCard'

vi.mock('../data', async (importOriginal) => ({
  ...(await importOriginal<typeof data>()),
  useAddCaffeine: vi.fn(),
  useUndoCaffeine: vi.fn(),
}))

const add = vi.fn()
const undo = vi.fn()
beforeEach(() => {
  add.mockReset()
  undo.mockReset()
  vi.mocked(useAddCaffeine).mockReturnValue({ mutate: add, isPending: false, error: null } as never)
  vi.mocked(useUndoCaffeine).mockReturnValue({ mutate: undo, isPending: false, error: null } as never)
})

const day = (totalMg: number, mealsMg: number): Day => ({
  date: '2026-10-21',
  goal: null,
  quota: null,
  totals: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  plannedKcal: 0,
  slots: [],
  suggestedSlot: null,
  nextSlot: null,
  waterMl: 0,
  caffeine: { totalMg, mealsMg },
  supplements: [],
})

describe('CaffeineCard (NUT-013)', () => {
  it('mostra il totale con la parte dai pasti, + aggiunge un espresso', () => {
    renderWithProviders(<CaffeineCard day={day(224, 64)} />)
    expect(screen.getByText('224')).toBeInTheDocument()
    expect(screen.getByText(/64 mg dai pasti/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Aggiungi un espresso, 80 mg' }))
    expect(add).toHaveBeenCalledWith('2026-10-21')
    fireEvent.click(screen.getByRole('button', { name: 'Annulla l’ultima caffeina' }))
    expect(undo).toHaveBeenCalledWith('2026-10-21')
  })

  it('con la sola caffeina dei pasti − è spento', () => {
    renderWithProviders(<CaffeineCard day={day(64, 64)} />)
    expect(screen.getByRole('button', { name: 'Annulla l’ultima caffeina' })).toBeDisabled()
  })
})

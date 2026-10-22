import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/test/render'
import type * as data from '../data'
import type { Day } from '../data'
import { useSetTaken } from '../data'
import { SupplementsCard } from './SupplementsCard'

vi.mock('../data', async (importOriginal) => ({
  ...(await importOriginal<typeof data>()),
  useSetTaken: vi.fn(),
}))

const mutate = vi.fn()
beforeEach(() => {
  mutate.mockReset()
  vi.mocked(useSetTaken).mockReturnValue({ mutate, isPending: false, error: null } as never)
})

const day = (supplements: Day['supplements']): Day => ({
  date: '2026-10-21',
  goal: null,
  quota: null,
  totals: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  plannedKcal: 0,
  slots: [],
  suggestedSlot: null,
  nextSlot: null,
  waterMl: 0,
  caffeine: { totalMg: 0, mealsMg: 0 },
  supplements,
})

describe('SupplementsCard (NUT-014)', () => {
  it('la checklist del giorno: quanti presi e la spunta', () => {
    renderWithProviders(
      <SupplementsCard
        day={day([
          { id: 's1', name: 'Creatina', dose: '5 g', schedule: 'mattina', taken: true },
          { id: 's2', name: 'Vitamina D', dose: null, schedule: 'sera', taken: false },
        ])}
      />,
    )
    expect(screen.getByText('1 di 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Creatina/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('5 g · mattina')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Vitamina D/ }))
    expect(mutate).toHaveBeenCalledWith({ id: 's2', date: '2026-10-21', taken: true })
  })

  it('senza integratori rimanda a Impostazioni', () => {
    renderWithProviders(<SupplementsCard day={day([])} />)
    expect(screen.getByRole('link', { name: 'Aggiungili in Impostazioni' })).toHaveAttribute(
      'href',
      '/impostazioni',
    )
  })
})

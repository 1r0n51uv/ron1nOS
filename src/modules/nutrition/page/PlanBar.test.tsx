import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/test/render'
import type * as data from '../data'
import type { SlotDay } from '../data'
import { useSetPlanStatus } from '../data'
import { PlanBar } from './PlanBar'

vi.mock('../data', async (importOriginal) => ({
  ...(await importOriginal<typeof data>()),
  useSetPlanStatus: vi.fn(),
}))

const mutate = vi.fn()
beforeEach(() => {
  mutate.mockReset()
  vi.mocked(useSetPlanStatus).mockReturnValue({ mutate, isPending: false, error: null } as never)
})

const lunch = (status: 'planned' | 'eaten' | 'skipped' | null): SlotDay => ({
  slot: 'lunch',
  state: status === null ? 'empty' : status,
  meal: null,
  planned: status
    ? {
        id: 'p1',
        status,
        recipeId: null,
        recipeName: null,
        templateName: null,
        kcal: 280,
        protein: 5.6,
        carbs: 62,
        fat: 0.5,
        items: [{ foodId: 'f1', name: 'Riso', grams: 80, kcal: 280, protein: 5.6, carbs: 62, fat: 0.5 }],
      }
    : null,
})

const bar = (slot: SlotDay) => renderWithProviders(<PlanBar date="2026-10-21" slot={slot} />)

describe('PlanBar (NUT-009)', () => {
  it('slot vuoto: Pianifica apre il modale del piano', () => {
    bar(lunch(null))
    fireEvent.click(screen.getByRole('button', { name: 'Pianifica Pranzo' }))
    expect(screen.getByRole('dialog', { name: 'Cosa vuoi mangiare' })).toBeInTheDocument()
    expect(screen.getByText('PIANIFICA · MERCOLEDÌ 21 OTTOBRE')).toBeInTheDocument()
  })

  it('pianificato: l’interruttore lo segna mangiato, Salta lo salta', () => {
    bar(lunch('planned'))
    const sw = screen.getByRole('switch', { name: 'Pranzo mangiato' })
    expect(sw).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(sw)
    expect(mutate).toHaveBeenLastCalledWith({ id: 'p1', status: 'eaten' })
    fireEvent.click(screen.getByRole('button', { name: 'Salta' }))
    expect(mutate).toHaveBeenLastCalledWith({ id: 'p1', status: 'skipped' })
  })

  it('Modifica parte dalle righe del piano', () => {
    bar(lunch('planned'))
    fireEvent.click(screen.getByRole('button', { name: 'Modifica Pranzo pianificato' }))
    expect(screen.getByRole('list', { name: 'Nel pasto' })).toHaveTextContent('Riso80 g280 kcal')
  })

  it('mangiato: spegnerlo torna pianificato, senza Modifica', () => {
    bar(lunch('eaten'))
    expect(screen.queryByRole('button', { name: /Modifica/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('switch', { name: 'Pranzo mangiato' }))
    expect(mutate).toHaveBeenLastCalledWith({ id: 'p1', status: 'planned' })
  })

  it('saltato: Ripristina', () => {
    bar(lunch('skipped'))
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ripristina' }))
    expect(mutate).toHaveBeenLastCalledWith({ id: 'p1', status: 'planned' })
  })
})

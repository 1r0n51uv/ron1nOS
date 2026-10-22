import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api'
import { renderWithProviders } from '@/test/render'
import type * as data from '../data'
import type { Goal } from '../data'
import { useGoals, useSaveGoal } from '../data'
import { GoalsPanel } from './GoalsPanel'

vi.mock('../data', async (importOriginal) => ({
  ...(await importOriginal<typeof data>()),
  useGoals: vi.fn(),
  useSaveGoal: vi.fn(),
}))

const goal: Goal = {
  id: 'g1',
  source: 'manual',
  kcal: 2021,
  protein: 126,
  carbs: 227,
  fat: 67,
  waterMl: 2500,
  effectiveFrom: '2026-10-01',
}

const mutate = vi.fn()
beforeEach(() => {
  mutate.mockReset()
  vi.mocked(useSaveGoal).mockReturnValue({ mutate, isPending: false, error: null } as unknown as ReturnType<
    typeof useSaveGoal
  >)
})

const goals = (v: Partial<data.Goals> & { error?: unknown }) =>
  vi.mocked(useGoals).mockReturnValue({
    data: 'error' in v ? undefined : { current: null, history: [], editable: true, ...v },
    error: v.error ?? null,
  } as ReturnType<typeof useGoals>)

describe('GoalsPanel', () => {
  it('mostra lo scheletro durante il caricamento', () => {
    vi.mocked(useGoals).mockReturnValue({ data: undefined, error: null } as ReturnType<typeof useGoals>)
    renderWithProviders(<GoalsPanel />)
    expect(screen.getByLabelText('Obiettivo nutrizionale: caricamento')).toBeInTheDocument()
  })

  it('senza YAZIO si imposta a mano e si salva', () => {
    goals({})
    renderWithProviders(<GoalsPanel />)
    const save = screen.getByRole('button', { name: 'Salva' })
    expect(save).toBeDisabled()
    for (const [label, value] of [
      ['Calorie', '2100'],
      ['Proteine', '130'],
      ['Carboidrati', '230'],
      ['Grassi', '70'],
      ['Acqua', '2500'],
    ])
      fireEvent.change(screen.getByLabelText(label), { target: { value } })
    fireEvent.click(save)
    expect(mutate).toHaveBeenCalledWith({ kcal: 2100, protein: 130, carbs: 230, fat: 70, waterMl: 2500 })
  })

  it("l'acqua è facoltativa", () => {
    goals({})
    renderWithProviders(<GoalsPanel />)
    for (const [label, value] of [
      ['Calorie', '2100'],
      ['Proteine', '130'],
      ['Carboidrati', '230'],
      ['Grassi', '70'],
    ])
      fireEvent.change(screen.getByLabelText(label), { target: { value } })
    fireEvent.click(screen.getByRole('button', { name: 'Salva' }))
    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ waterMl: null }))
  })

  it('parte dai valori correnti e mostra lo storico', () => {
    goals({ current: goal, history: [goal, { ...goal, id: 'g0', kcal: 1900, effectiveFrom: '2026-09-01' }] })
    renderWithProviders(<GoalsPanel />)
    expect(screen.getByLabelText('Calorie')).toHaveValue(2021)
    expect(screen.getByText('dal 1 set')).toBeInTheDocument()
    expect(screen.getByText('1900 kcal · P 126 · C 227 · G 67 g')).toBeInTheDocument()
  })

  it('da YAZIO è in sola lettura', () => {
    goals({ current: { ...goal, source: 'yazio' }, history: [goal], editable: false })
    renderWithProviders(<GoalsPanel />)
    expect(screen.queryByRole('button', { name: 'Salva' })).not.toBeInTheDocument()
    expect(screen.getByText('2021 kcal · P 126 · C 227 · G 67 g')).toBeInTheDocument()
    expect(screen.getByText("Si modifica nell'app YAZIO.")).toBeInTheDocument()
    expect(screen.getByText('da YAZIO')).toBeInTheDocument()
  })

  it('senza database lo dice', () => {
    goals({ error: new ApiError('database_unavailable', 'Database non raggiungibile', 503) })
    renderWithProviders(<GoalsPanel />)
    expect(screen.getByText('Database non raggiungibile')).toBeInTheDocument()
  })
})

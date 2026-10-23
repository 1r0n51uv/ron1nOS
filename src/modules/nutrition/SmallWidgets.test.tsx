import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/test/render'
import type * as data from './data'
import type { Day } from './data'
import { useDay } from './data'
import { CaloriesWidget, NextMealWidget, SupplementsWidget } from './SmallWidgets'

vi.mock('./data', async (importOriginal) => ({
  ...(await importOriginal<typeof data>()),
  useDay: vi.fn(),
}))

const day = (over: Partial<Day> = {}): Day => ({
  date: '2026-10-23',
  goal: null,
  quota: { kcal: 2000, baseKcal: 2000, activityKcal: 0 },
  totals: { kcal: 1200, protein: 0, carbs: 0, fat: 0 },
  plannedKcal: 0,
  slots: [],
  suggestedSlot: null,
  nextSlot: 'dinner',
  waterMl: 0,
  caffeine: { totalMg: 0, mealsMg: 0 },
  supplements: [],
  ...over,
})
const mockDay = (d?: Day, error: unknown = null) =>
  vi.mocked(useDay).mockReturnValue({ data: d, error } as ReturnType<typeof useDay>)

describe('widget piccoli della Nutrizione (DASH-002)', () => {
  it('Calorie: solo l’anello', () => {
    mockDay(day())
    renderWithProviders(<CaloriesWidget />)
    expect(screen.getByRole('img', { name: /^1\.?200 kcal su 2\.?000$/ })).toBeInTheDocument()
  })

  it('Prossimo pasto: lo slot e cosa c’è, o pasti completati', () => {
    mockDay(day())
    const { unmount } = renderWithProviders(<NextMealWidget />)
    expect(screen.getByText('Cena')).toBeInTheDocument()
    expect(screen.getByText('Niente pianificato')).toBeInTheDocument()
    unmount()
    mockDay(day({ nextSlot: null }))
    renderWithProviders(<NextMealWidget />)
    expect(screen.getByText('Pasti completati')).toBeInTheDocument()
  })

  it('Integratori: presi e mancanti', () => {
    const s = (name: string, taken: boolean) => ({ id: name, name, dose: null, schedule: null, taken })
    mockDay(day({ supplements: [s('Omega 3', false), s('Magnesio', true), s('Vitamina D', false)] }))
    renderWithProviders(<SupplementsWidget />)
    expect(screen.getByRole('img', { name: '1 di 3 integratori' })).toBeInTheDocument()
    expect(screen.getByText('Mancano Omega 3 · Vitamina D')).toBeInTheDocument()
  })

  it('backend giù: lo dice', () => {
    mockDay(undefined, new Error('giù'))
    renderWithProviders(<SupplementsWidget />)
    expect(screen.getByText('Diario non disponibile.')).toBeInTheDocument()
  })
})

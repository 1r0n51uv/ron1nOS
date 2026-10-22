import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/test/render'
import type * as data from '../data'
import type { Day } from '../data'
import { useDay } from '../data'
import { todayRome } from '../dates'
import { MealsPage } from './MealsPage'

vi.mock('../data', async (importOriginal) => ({
  ...(await importOriginal<typeof data>()),
  useDay: vi.fn(),
}))

const empty = (slot: Day['slots'][number]['slot']): Day['slots'][number] => ({
  slot,
  state: 'empty',
  meal: null,
  planned: null,
})

function day(date: string, over: Partial<Day> = {}): Day {
  return {
    date,
    goal: { kcal: 2021, protein: 126, carbs: 227, fat: 67, waterMl: 2500 },
    totals: { kcal: 285, protein: 23.5, carbs: 36.6, fat: 3.5 },
    plannedKcal: 445,
    suggestedSlot: null,
    nextSlot: null,
    waterMl: 0,
    caffeine: { totalMg: 0, mealsMg: 0 },
    supplements: [],
    slots: [
      {
        slot: 'breakfast',
        state: 'eaten',
        meal: {
          id: 'm1',
          kcal: 285,
          protein: 23.5,
          carbs: 36.6,
          fat: 3.5,
          items: [
            {
              id: 'i1',
              foodId: null,
              name: 'Yogurt greco 0%',
              grams: 170,
              kcal: 99,
              protein: 17,
              carbs: 6.6,
              fat: 0,
              origin: 'ron1nos',
              sync: 'local',
            },
          ],
        },
        planned: null,
      },
      empty('morning_snack'),
      {
        slot: 'lunch',
        state: 'planned',
        meal: null,
        planned: {
          id: 'p1',
          status: 'planned',
          recipeId: null,
          recipeName: null,
          templateName: 'Definizione',
          kcal: 445,
          protein: 40,
          carbs: 62,
          fat: 2,
          items: [
            { foodId: 'f1', name: 'Riso basmati', grams: 80, kcal: 280, protein: 5.6, carbs: 62, fat: 0.5 },
          ],
        },
      },
      empty('afternoon_snack'),
      { ...empty('dinner'), state: 'skipped' },
    ],
    ...over,
  }
}

const mockDay = (d: Day | undefined) =>
  vi
    .mocked(useDay)
    .mockImplementation(
      (date: string) => ({ data: d && { ...d, date }, error: null }) as ReturnType<typeof useDay>,
    )

describe('MealsPage', () => {
  it('mostra i 5 pasti con il loro stato', () => {
    mockDay(day(todayRome()))
    renderWithProviders(<MealsPage />, { route: '/pasti' })
    const breakfast = screen.getByRole('article', { name: 'Colazione' })
    expect(within(breakfast).getByText('mangiato')).toBeInTheDocument()
    expect(within(breakfast).getByText('Yogurt greco 0%')).toBeInTheDocument()
    const lunch = screen.getByRole('article', { name: 'Pranzo' })
    expect(within(lunch).getByText('pianificato')).toBeInTheDocument()
    expect(within(lunch).getByText('dal template Definizione')).toBeInTheDocument()
    expect(
      within(screen.getByRole('article', { name: 'Spuntino' })).getByText('Niente registrato.'),
    ).toBeInTheDocument()
    expect(within(screen.getByRole('article', { name: 'Cena' })).getByText('saltato')).toBeInTheDocument()
  })

  it('il riepilogo usa totali e obiettivo del giorno', () => {
    mockDay(day(todayRome()))
    renderWithProviders(<MealsPage />, { route: '/pasti' })
    const aside = screen.getByRole('complementary', { name: 'Riepilogo del giorno' })
    expect(within(aside).getByText('Oggi')).toBeInTheDocument()
    expect(within(aside).getByRole('img', { name: '285 kcal su 2021' })).toBeInTheDocument()
    expect(within(aside).getByText('24 / 126 g')).toBeInTheDocument()
    expect(within(aside).getByText('1736')).toBeInTheDocument()
  })

  it('con ?giorno= mostra quel giorno, non oggi', () => {
    mockDay(day('2026-10-15'))
    renderWithProviders(<MealsPage />, { route: '/pasti?giorno=2026-10-15' })
    expect(vi.mocked(useDay)).toHaveBeenCalledWith('2026-10-15')
    expect(screen.getByText('GIOVEDÌ 15 OTTOBRE')).toBeInTheDocument()
    expect(screen.getByText('Giorno')).toBeInTheDocument()
  })

  it('la striscia ha 24 giorni e oggi segnato', () => {
    mockDay(day(todayRome()))
    renderWithProviders(<MealsPage />, { route: '/pasti' })
    const strip = screen.getByRole('navigation', { name: 'Giorni' })
    expect(within(strip).getAllByRole('link')).toHaveLength(24)
    expect(within(strip).getByRole('link', { name: 'Oggi' })).toHaveAttribute('aria-current', 'date')
  })

  it('durante il caricamento mostra gli scheletri', () => {
    mockDay(undefined)
    renderWithProviders(<MealsPage />, { route: '/pasti' })
    expect(document.querySelectorAll('[aria-busy="true"]').length).toBeGreaterThan(0)
  })
})

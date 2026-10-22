import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api'
import { renderWithProviders } from '@/test/render'
import type * as data from './data'
import type { Day, SlotDay } from './data'
import { useDay } from './data'
import { NutritionWidget } from './Widget'

vi.mock('./data', async (importOriginal) => ({
  ...(await importOriginal<typeof data>()),
  useDay: vi.fn(),
}))

const slot = (s: SlotDay['slot'], state: SlotDay['state'] = 'empty'): SlotDay => ({
  slot: s,
  state,
  meal: null,
  planned: null,
})

function day(over: Partial<Day> = {}): Day {
  return {
    date: '2026-10-21',
    goal: { kcal: 2021, protein: 126, carbs: 227, fat: 67, waterMl: null },
    quota: { kcal: 2021, baseKcal: 2021, activityKcal: 0 },
    totals: { kcal: 1022, protein: 26, carbs: 83, fat: 6 },
    plannedKcal: 479,
    suggestedSlot: 'lunch',
    nextSlot: 'lunch',
    waterMl: 0,
    caffeine: { totalMg: 0, mealsMg: 0 },
    supplements: [],
    slots: [
      slot('breakfast', 'eaten'),
      slot('morning_snack', 'eaten'),
      {
        ...slot('lunch', 'planned'),
        planned: {
          id: 'p1',
          status: 'planned',
          recipeId: null,
          recipeName: null,
          templateName: null,
          kcal: 479,
          protein: 40,
          carbs: 60,
          fat: 5,
          items: [
            { foodId: 'f1', name: 'Riso', grams: 80, kcal: 280, protein: 5, carbs: 60, fat: 1 },
            { foodId: 'f2', name: 'Pollo', grams: 150, kcal: 165, protein: 35, carbs: 0, fat: 2 },
            { foodId: 'f3', name: 'Zucchine', grams: 200, kcal: 34, protein: 0, carbs: 0, fat: 2 },
          ],
        },
      },
      slot('afternoon_snack'),
      slot('dinner'),
    ],
    ...over,
  }
}

const mockDay = (v: { data?: Day; error?: unknown }) =>
  vi.mocked(useDay).mockReturnValue({ data: v.data, error: v.error ?? null } as ReturnType<typeof useDay>)

describe('NutritionWidget (NUT-001)', () => {
  it('mostra lo scheletro al primo caricamento', () => {
    mockDay({})
    renderWithProviders(<NutritionWidget />)
    expect(screen.getByLabelText('Nutrizione: caricamento')).toBeInTheDocument()
  })

  it('kcal sull’obiettivo, prossimo pasto pianificato e macro', () => {
    mockDay({ data: day() })
    renderWithProviders(<NutritionWidget />)
    expect(screen.getByRole('img', { name: /^1\.?022 kcal su 2\.?021$/ })).toBeInTheDocument()
    expect(screen.getByText('Prossimo pasto')).toBeInTheDocument()
    expect(screen.getByText('Pranzo')).toBeInTheDocument()
    expect(screen.getByText('Riso, Pollo, Zucchine · 479 kcal')).toBeInTheDocument()
    expect(screen.getByLabelText('Proteine 26 / 126 g')).toBeInTheDocument()
    expect(screen.getByLabelText('Grassi 6 / 67 g')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Dettagli/ })).toHaveAttribute('href', '/pasti')
  })

  it('l’anello usa la quota del giorno, con l’attività da YAZIO (NUT-016)', () => {
    mockDay({ data: day({ quota: { kcal: 2098, baseKcal: 2021, activityKcal: 77 } }) })
    renderWithProviders(<NutritionWidget />)
    expect(screen.getByRole('img', { name: /^1\.?022 kcal su 2\.?098$/ })).toBeInTheDocument()
  })

  it('uno slot vuoto dice che non c’è niente pianificato', () => {
    mockDay({ data: day({ nextSlot: 'dinner' }) })
    renderWithProviders(<NutritionWidget />)
    expect(screen.getByText('Cena')).toBeInTheDocument()
    expect(screen.getByText('Niente pianificato')).toBeInTheDocument()
  })

  it('pasti completati: quante kcal restano', () => {
    mockDay({ data: day({ nextSlot: null, totals: { kcal: 1957, protein: 131, carbs: 214, fat: 62 } }) })
    renderWithProviders(<NutritionWidget />)
    expect(screen.getByText('Pasti completati')).toBeInTheDocument()
    expect(screen.getByText('64 kcal')).toBeInTheDocument()
  })

  it('backend giù: lo dice', () => {
    mockDay({ error: new ApiError('database_unavailable', 'Database non disponibile', 503) })
    renderWithProviders(<NutritionWidget />)
    expect(screen.getByText('Diario non disponibile.')).toBeInTheDocument()
  })
})

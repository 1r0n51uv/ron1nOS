import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/test/render'
import type * as data from '../data'
import type { Template } from '../data'
import { useApplyTemplate, useDeleteTemplate, useSaveTemplate, useTemplates } from '../data'
import { TemplatesPage } from './TemplatesPage'

vi.mock('../data', async (importOriginal) => ({
  ...(await importOriginal<typeof data>()),
  useTemplates: vi.fn(),
  useSaveTemplate: vi.fn(),
  useDeleteTemplate: vi.fn(),
  useApplyTemplate: vi.fn(),
}))

const definizione: Template = {
  id: 't1',
  name: 'Definizione',
  dayKcal: [539, 0, 445, 0, 0, 0, 0],
  cells: [
    { weekday: 1, slot: 'morning_snack', recipeId: null, foodId: 'f1', grams: 180, name: 'Mela', kcal: 94 },
    { weekday: 1, slot: 'lunch', recipeId: 'r1', foodId: null, grams: null, name: 'Riso e pollo', kcal: 445 },
    {
      weekday: 3,
      slot: 'dinner',
      recipeId: 'r1',
      foodId: null,
      grams: null,
      name: 'Riso e pollo',
      kcal: 445,
    },
  ],
}
const massa: Template = { id: 't2', name: 'Massa', dayKcal: [0, 0, 0, 0, 0, 0, 0], cells: [] }

const save = vi.fn()
const apply = vi.fn()
let applied: unknown = undefined
beforeEach(() => {
  save.mockReset()
  apply.mockReset()
  applied = undefined
  vi.mocked(useTemplates).mockReturnValue({ data: { templates: [definizione, massa] }, error: null } as never)
  vi.mocked(useSaveTemplate).mockReturnValue({ mutate: save, isPending: false, error: null } as never)
  vi.mocked(useDeleteTemplate).mockReturnValue({ mutate: vi.fn(), isPending: false, error: null } as never)
  vi.mocked(useApplyTemplate).mockImplementation(
    () => ({ mutate: apply, isPending: false, error: null, data: applied }) as never,
  )
})

describe('TemplatesPage (NUT-010)', () => {
  it('griglia 7 × 5 con le celle e i totali del giorno', () => {
    renderWithProviders(<TemplatesPage />, { route: '/pasti/template' })
    expect(screen.getByRole('heading', { name: 'Definizione', level: 1 })).toBeInTheDocument()
    expect(
      screen.getAllByRole('button', { name: /^(Lunedì|Martedì|Mercoledì|Giovedì|Venerdì|Sabato|Domenica) / }),
    ).toHaveLength(35)
    expect(screen.getByRole('button', { name: 'Lunedì Pranzo: Riso e pollo' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Martedì Pranzo: vuoto' })).toBeInTheDocument()
    expect(screen.getByLabelText('Totale Lunedì: 539 kcal')).toBeInTheDocument()
  })

  it('una cella apre l’editor con ricetta o alimento', () => {
    renderWithProviders(<TemplatesPage />, { route: '/pasti/template' })
    fireEvent.click(screen.getByRole('button', { name: 'Lunedì Spuntino: Mela' }))
    expect(screen.getByRole('dialog', { name: 'Lunedì · Spuntino' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Alimento' })).toHaveAttribute('aria-selected', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Svuota' }))
    expect(save.mock.calls[0][0]).toEqual({
      id: 't1',
      input: {
        name: 'Definizione',
        cells: [
          { weekday: 1, slot: 'lunch', recipeId: 'r1' },
          { weekday: 3, slot: 'dinner', recipeId: 'r1' },
        ],
      },
    })
  })

  it('cambia template', () => {
    renderWithProviders(<TemplatesPage />, { route: '/pasti/template' })
    fireEvent.click(screen.getByRole('button', { name: 'Massa' }))
    expect(screen.getByRole('heading', { name: 'Massa', level: 1 })).toBeInTheDocument()
  })

  it('applica alla settimana prossima di default', () => {
    renderWithProviders(<TemplatesPage />, { route: '/pasti/template' })
    expect(screen.getByText(/^Crea 3 pasti pianificati/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Applica' }))
    const { monday } = apply.mock.calls[0][0]
    expect(new Date(`${monday}T12:00:00Z`).getUTCDay()).toBe(1)
  })

  it('mostra il risultato', () => {
    applied = { created: 30, replaced: 2, kept: 0 }
    renderWithProviders(<TemplatesPage />, { route: '/pasti/template' })
    expect(screen.getByText('Creati 30 · sostituiti 2 · lasciati 0')).toBeInTheDocument()
  })

  it('Nuovo crea un template vuoto', () => {
    renderWithProviders(<TemplatesPage />, { route: '/pasti/template' })
    fireEvent.click(screen.getByRole('button', { name: 'Nuovo' }))
    fireEvent.change(screen.getByLabelText('Nome del template'), { target: { value: 'Mantenimento' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crea' }))
    expect(save.mock.calls[0][0]).toEqual({ input: { name: 'Mantenimento', cells: [] } })
  })
})

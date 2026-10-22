import { fireEvent, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/test/render'
import type * as data from '../data'
import type { Recipe } from '../data'
import { useDay, useDeleteRecipe, useRecipes, useSaveRecipe } from '../data'
import { RecipesPage } from './RecipesPage'

vi.mock('../data', async (importOriginal) => ({
  ...(await importOriginal<typeof data>()),
  useRecipes: vi.fn(),
  useSaveRecipe: vi.fn(),
  useDeleteRecipe: vi.fn(),
  useDay: vi.fn(),
}))

const recipe = (id: string, name: string, kcal: number): Recipe => ({
  id,
  name,
  notes: id === 'r1' ? "Zucchine in padella con un filo d'olio." : null,
  grams: 430,
  kcal,
  protein: 42.5,
  carbs: 68,
  fat: 4,
  items: [
    {
      id: `${id}-1`,
      foodId: 'f1',
      name: 'Riso basmati',
      grams: 80,
      kcal: 280,
      protein: 5.6,
      carbs: 62,
      fat: 0.5,
      missing: false,
    },
    {
      id: `${id}-2`,
      foodId: null,
      name: 'Petto di pollo',
      grams: 150,
      kcal: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      missing: true,
    },
  ],
})

const save = vi.fn()
const remove = vi.fn()
beforeEach(() => {
  save.mockReset()
  remove.mockReset()
  vi.mocked(useRecipes).mockReturnValue({
    data: { recipes: [recipe('r1', 'Riso, pollo e zucchine', 479), recipe('r2', 'Salmone e patate', 505)] },
    error: null,
  } as never)
  vi.mocked(useSaveRecipe).mockReturnValue({ mutate: save, isPending: false, error: null } as never)
  vi.mocked(useDeleteRecipe).mockReturnValue({ mutate: remove, isPending: false, error: null } as never)
  vi.mocked(useDay).mockReturnValue({ data: undefined, error: null } as never)
})

describe('RecipesPage (NUT-008)', () => {
  it('elenca le ricette e mostra la prima con alimenti e totali', () => {
    renderWithProviders(<RecipesPage />, { route: '/pasti/ricette' })
    const list = screen.getByRole('list', { name: 'Ricette' })
    expect(
      within(list)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Riso, pollo e zucchine479', 'Salmone e patate505'])
    expect(screen.getByText("Zucchine in padella con un filo d'olio.")).toBeInTheDocument()
    expect(screen.getByText('· alimento eliminato')).toBeInTheDocument()
    expect(screen.getByText('43 g')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Registra oggi' })).toBeInTheDocument()
  })

  it('scegliere una ricetta la mostra', () => {
    renderWithProviders(<RecipesPage />, { route: '/pasti/ricette' })
    fireEvent.click(screen.getByRole('button', { name: /Salmone e patate/ }))
    expect(screen.getByRole('button', { name: /Salmone e patate/ })).toHaveAttribute('aria-current', 'true')
  })

  it('Modifica apre l’editor con nome e alimenti, senza quelli eliminati', () => {
    renderWithProviders(<RecipesPage />, { route: '/pasti/ricette?ricetta=r1' })
    fireEvent.click(screen.getByRole('button', { name: 'Modifica' }))
    const form = screen.getByRole('form', { name: 'Ricetta' })
    expect(within(form).getByLabelText('Nome')).toHaveValue('Riso, pollo e zucchine')
    expect(screen.getByText('Un alimento eliminato è stato tolto.')).toBeInTheDocument()
    fireEvent.change(within(form).getByLabelText('Nome'), { target: { value: 'Riso e zucchine' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salva' }))
    expect(save.mock.calls[0][0]).toEqual({
      id: 'r1',
      input: {
        name: 'Riso e zucchine',
        notes: "Zucchine in padella con un filo d'olio.",
        items: [{ foodId: 'f1', grams: 80 }],
      },
    })
  })

  it('Nuova apre un editor vuoto; senza alimenti Salva è spento', () => {
    renderWithProviders(<RecipesPage />, { route: '/pasti/ricette' })
    fireEvent.click(screen.getByRole('button', { name: 'Nuova' }))
    const form = screen.getByRole('form', { name: 'Ricetta' })
    fireEvent.change(within(form).getByLabelText('Nome'), { target: { value: 'Colazione' } })
    expect(screen.getByRole('button', { name: 'Salva' })).toBeDisabled()
  })

  it('Elimina chiede conferma', () => {
    renderWithProviders(<RecipesPage />, { route: '/pasti/ricette?ricetta=r2' })
    fireEvent.click(screen.getByRole('button', { name: 'Elimina' }))
    fireEvent.click(screen.getByRole('button', { name: 'Elimina davvero' }))
    expect(remove.mock.calls[0][0]).toBe('r2')
  })
})

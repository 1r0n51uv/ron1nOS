import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/test/render'
import type * as data from '../data'
import type { Day } from '../data'
import { useAddWater, useUndoWater } from '../data'
import { WaterCard } from './WaterCard'

vi.mock('../data', async (importOriginal) => ({
  ...(await importOriginal<typeof data>()),
  useAddWater: vi.fn(),
  useUndoWater: vi.fn(),
}))

const add = vi.fn()
const undo = vi.fn()
beforeEach(() => {
  add.mockReset()
  undo.mockReset()
  vi.mocked(useAddWater).mockReturnValue({ mutate: add, isPending: false, error: null } as never)
  vi.mocked(useUndoWater).mockReturnValue({ mutate: undo, isPending: false, error: null } as never)
})

const day = (waterMl: number, goal: number | null = 2000): Day => ({
  date: '2026-10-21',
  goal: { kcal: 2000, protein: 120, carbs: 220, fat: 65, waterMl: goal },
  totals: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  plannedKcal: 0,
  slots: [],
  suggestedSlot: null,
  nextSlot: null,
  waterMl,
})

describe('WaterCard (NUT-012)', () => {
  it('mostra i ml sull’obiettivo, + aggiunge e − annulla', () => {
    renderWithProviders(<WaterCard day={day(750)} />)
    expect(screen.getByText(/^obiettivo 2\.?000 ml$/)).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: /^Acqua 750 di 2\.?000 ml$/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Aggiungi 250 ml' }))
    expect(add).toHaveBeenCalledWith('2026-10-21')
    fireEvent.click(screen.getByRole('button', { name: 'Annulla l’ultima acqua' }))
    expect(undo).toHaveBeenCalledWith('2026-10-21')
  })

  it('senza acqua − è spento; senza obiettivo niente barra', () => {
    renderWithProviders(<WaterCard day={day(0, null)} />)
    expect(screen.getByRole('button', { name: 'Annulla l’ultima acqua' })).toBeDisabled()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.getByText('senza obiettivo')).toBeInTheDocument()
  })
})

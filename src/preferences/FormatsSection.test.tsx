import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api'
import { renderWithProviders } from '@/test/render'
import { DEFAULT_PREFERENCES } from '../../server/preferences/schema.ts'
import type { Preferences, PreferencesResponse } from './data'
import { source } from './data'
import { FormatsSection } from './FormatsSection'

const prefs = (formats: Partial<Preferences['formats']> = {}): PreferencesResponse => ({
  ...DEFAULT_PREFERENCES,
  formats: { ...DEFAULT_PREFERENCES.formats, ...formats },
  updatedAt: null,
  backgroundImage: null,
  stored: true,
})

describe('Impostazioni › Formati (SET-010)', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('mostra fuso, unità e lingua non modificabile', async () => {
    vi.spyOn(source, 'getPreferences').mockResolvedValue(prefs({ energyUnit: 'kJ' }))
    renderWithProviders(<FormatsSection />)
    await waitFor(() =>
      expect(screen.getByRole('radio', { name: 'kJ' })).toHaveAttribute('aria-checked', 'true'),
    )
    expect(screen.getByLabelText('Fuso orario')).toHaveValue('Europe/Rome')
    expect(screen.getByRole('radio', { name: 'kg' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByLabelText('Lingua')).toHaveTextContent('Italiano')
    expect(screen.getByText('Calorie dei pasti · 2000 kcal = 8368 kJ')).toBeInTheDocument()
  })

  it('ogni scelta si salva da sola', async () => {
    vi.spyOn(source, 'getPreferences').mockResolvedValue(prefs())
    const patch = vi.spyOn(source, 'patchPreferences').mockResolvedValue(prefs({ weightUnit: 'lb' }))
    renderWithProviders(<FormatsSection />)
    fireEvent.click(await screen.findByRole('radio', { name: 'lb' }))
    await waitFor(() => expect(patch).toHaveBeenCalledWith({ formats: { weightUnit: 'lb' } }))
    fireEvent.change(screen.getByLabelText('Fuso orario'), { target: { value: 'Europe/London' } })
    await waitFor(() => expect(patch).toHaveBeenCalledWith({ formats: { timeZone: 'Europe/London' } }))
  })

  it('se il salvataggio fallisce la scelta torna com’era e l’errore sta accanto', async () => {
    vi.spyOn(source, 'getPreferences').mockResolvedValue(prefs())
    vi.spyOn(source, 'patchPreferences').mockRejectedValue(new ApiError('network', 'x', 0))
    renderWithProviders(<FormatsSection />)
    fireEvent.click(await screen.findByRole('radio', { name: 'kJ' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Energia non salvato')
    expect(screen.getByRole('radio', { name: 'kcal' })).toHaveAttribute('aria-checked', 'true')
  })
})

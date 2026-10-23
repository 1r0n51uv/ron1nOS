import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api'
import { renderWithProviders } from '@/test/render'
import { DEFAULT_PREFERENCES } from '../../server/preferences/schema.ts'
import type { PreferencesResponse } from './data'
import { source } from './data'
import { ModuleGate } from './ModuleGate'
import { ModulesSection } from './ModulesSection'

const prefs = (disabledModules: PreferencesResponse['disabledModules'] = []): PreferencesResponse => ({
  ...DEFAULT_PREFERENCES,
  disabledModules,
  updatedAt: null,
  backgroundImage: null,
  stored: true,
})

describe('Impostazioni › Moduli (SET-005)', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('un interruttore per modulo, e il link alle impostazioni di chi ne ha', async () => {
    vi.spyOn(source, 'getPreferences').mockResolvedValue(prefs(['notes']))
    renderWithProviders(<ModulesSection />)
    const list = await screen.findByRole('list', { name: 'Moduli' })
    expect(within(list).getAllByRole('switch')).toHaveLength(9)
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Note' })).not.toBeChecked())
    expect(screen.getByRole('switch', { name: 'Nutrizione' })).toBeChecked()
    expect(screen.getByRole('link', { name: 'Impostazioni · Nutrizione' })).toHaveAttribute(
      'href',
      '/impostazioni/moduli/nutrizione',
    )
  })

  it('spegnere un modulo lo aggiunge ai moduli spenti', async () => {
    vi.spyOn(source, 'getPreferences').mockResolvedValue(prefs(['notes']))
    const patch = vi.spyOn(source, 'patchPreferences').mockResolvedValue(prefs(['notes', 'downloads']))
    renderWithProviders(<ModulesSection />)
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Note' })).not.toBeChecked())
    fireEvent.click(screen.getByRole('switch', { name: 'Download' }))
    await waitFor(() => expect(patch).toHaveBeenCalledWith({ disabledModules: ['notes', 'downloads'] }))
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Download' })).not.toBeChecked())
  })

  it('se il salvataggio fallisce l’interruttore torna com’era e l’errore sta accanto', async () => {
    vi.spyOn(source, 'getPreferences').mockResolvedValue(prefs())
    vi.spyOn(source, 'patchPreferences').mockRejectedValue(new ApiError('network', 'x', 0))
    renderWithProviders(<ModulesSection />)
    fireEvent.click(await screen.findByRole('switch', { name: 'Peso' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Peso · modifica non salvata')
    expect(screen.getByRole('switch', { name: 'Peso' })).toBeChecked()
  })

  it('la pagina di un modulo spento mostra `Modulo spento` con il link per riaccenderlo', async () => {
    vi.spyOn(source, 'getPreferences').mockResolvedValue(prefs(['workout']))
    renderWithProviders(
      <ModuleGate module="workout" title="Allenamenti">
        <p>contenuto</p>
      </ModuleGate>,
    )
    expect(await screen.findByText('Modulo spento')).toBeInTheDocument()
    expect(screen.queryByText('contenuto')).toBeNull()
    expect(screen.getByRole('link', { name: 'Impostazioni › Moduli' })).toHaveAttribute(
      'href',
      '/impostazioni/moduli',
    )
  })
})

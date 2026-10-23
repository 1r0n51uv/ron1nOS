import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api'
import { renderWithProviders } from '@/test/render'
import { DEFAULT_PREFERENCES, NAV_ITEMS } from '../../server/preferences/schema.ts'
import type { PreferencesResponse } from './data'
import { source } from './data'
import { NavigationSection } from './NavigationSection'

const prefs = (navOrder: PreferencesResponse['navOrder'] = [...NAV_ITEMS]): PreferencesResponse => ({
  ...DEFAULT_PREFERENCES,
  navOrder,
  updatedAt: null,
  backgroundImage: null,
  stored: true,
})

const labels = () =>
  within(screen.getByRole('list', { name: 'Voci della barra' }))
    .getAllByRole('listitem')
    .map((li) => li.getAttribute('aria-label'))

describe('Impostazioni › Navigazione (SET-006)', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('Dashboard prima, Impostazioni ultima, in mezzo l’ordine salvato', async () => {
    vi.spyOn(source, 'getPreferences').mockResolvedValue(
      prefs(['server', 'pasti', 'allenamenti', 'documenti', 'note', 'casa']),
    )
    renderWithProviders(<NavigationSection />)
    await waitFor(() => expect(labels()[1]).toBe('Server e container'))
    expect(labels()[0]).toBe('Dashboard')
    expect(labels().at(-1)).toBe('Impostazioni')
    expect(screen.getByRole('button', { name: 'Sposta su · Server e container' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Sposta giù · Casa' })).toBeDisabled()
  })

  it('le frecce spostano la voce e salvano il nuovo ordine', async () => {
    vi.spyOn(source, 'getPreferences').mockResolvedValue(prefs())
    const patch = vi
      .spyOn(source, 'patchPreferences')
      .mockResolvedValue(prefs(['allenamenti', 'pasti', 'documenti', 'note', 'casa', 'server']))
    renderWithProviders(<NavigationSection />)
    fireEvent.click(await screen.findByRole('button', { name: 'Sposta giù · Pasti' }))
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith({
        navOrder: ['allenamenti', 'pasti', 'documenti', 'note', 'casa', 'server'],
      }),
    )
    await waitFor(() => expect(labels()[1]).toBe('Allenamenti'))
  })

  it('trascinare una voce su un’altra la mette al suo posto', async () => {
    vi.spyOn(source, 'getPreferences').mockResolvedValue(prefs())
    const patch = vi.spyOn(source, 'patchPreferences').mockResolvedValue(prefs())
    renderWithProviders(<NavigationSection />)
    const list = await screen.findByRole('list', { name: 'Voci della barra' })
    const note = within(list).getByRole('listitem', { name: 'Note' })
    const pasti = within(list).getByRole('listitem', { name: 'Pasti' })
    const dataTransfer = { effectAllowed: '' }
    fireEvent.dragStart(note, { dataTransfer })
    fireEvent.dragOver(pasti, { dataTransfer })
    fireEvent.drop(pasti, { dataTransfer })
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith({
        navOrder: ['note', 'pasti', 'allenamenti', 'documenti', 'casa', 'server'],
      }),
    )
  })

  it('`Ripristina ordine` torna al predefinito, ed è spento se lo è già', async () => {
    vi.spyOn(source, 'getPreferences').mockResolvedValue(
      prefs(['casa', 'pasti', 'allenamenti', 'documenti', 'note', 'server']),
    )
    const patch = vi.spyOn(source, 'patchPreferences').mockResolvedValue(prefs())
    renderWithProviders(<NavigationSection />)
    await waitFor(() => expect(labels()[1]).toBe('Casa'))
    fireEvent.click(screen.getByRole('button', { name: 'Ripristina ordine' }))
    await waitFor(() => expect(patch).toHaveBeenCalledWith({ navOrder: [...NAV_ITEMS] }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Ripristina ordine' })).toBeDisabled())
  })

  it('se il salvataggio fallisce l’ordine torna com’era e compare l’errore', async () => {
    vi.spyOn(source, 'getPreferences').mockResolvedValue(prefs())
    vi.spyOn(source, 'patchPreferences').mockRejectedValue(new ApiError('network', 'x', 0))
    renderWithProviders(<NavigationSection />)
    fireEvent.click(await screen.findByRole('button', { name: 'Sposta giù · Pasti' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Ordine non salvato')
    expect(labels()[1]).toBe('Pasti')
  })
})

import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api'
import { renderWithProviders } from '@/test/render'
import { DEFAULT_PREFERENCES } from '../../server/preferences/schema.ts'
import { AppearanceSection } from './AppearanceSection'
import type { PreferencesResponse } from './data'
import { source } from './data'

const prefs: PreferencesResponse = {
  ...DEFAULT_PREFERENCES,
  updatedAt: null,
  backgroundImage: null,
  stored: true,
}

describe('Impostazioni › Aspetto (SET-003)', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.spyOn(source, 'getPreferences').mockResolvedValue(prefs)
  })
  afterEach(() => vi.restoreAllMocks())

  it('segna le scelte attuali', async () => {
    renderWithProviders(<AppearanceSection />)
    expect(await screen.findByRole('radio', { name: 'Brace (predefinito)' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(screen.getByRole('radio', { name: 'Medio' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'Comoda' })).toHaveAttribute('aria-checked', 'true')
    // Senza immagine caricata non c'è la scelta Immagine.
    expect(screen.queryByRole('radio', { name: 'Immagine' })).toBeNull()
  })

  it('una scelta si vede subito e si salva da sola', async () => {
    const patch = vi
      .spyOn(source, 'patchPreferences')
      .mockResolvedValue({ ...prefs, appearance: { ...prefs.appearance, density: 'compact' } })
    renderWithProviders(<AppearanceSection />)
    fireEvent.click(await screen.findByRole('radio', { name: 'Compatta' }))
    await waitFor(() =>
      expect(screen.getByRole('radio', { name: 'Compatta' })).toHaveAttribute('aria-checked', 'true'),
    )
    expect(patch).toHaveBeenCalledWith({ appearance: { density: 'compact' } })
  })

  it('se il salvataggio fallisce torna la scelta di prima e l’errore sta accanto al campo', async () => {
    vi.spyOn(source, 'patchPreferences').mockRejectedValue(new ApiError('network', 'x', 0))
    renderWithProviders(<AppearanceSection />)
    fireEvent.click(await screen.findByRole('radio', { name: 'Intenso' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Vetro non salvato · riprova')
    await waitFor(() =>
      expect(screen.getByRole('radio', { name: 'Medio' })).toHaveAttribute('aria-checked', 'true'),
    )
  })

  it('carica un’immagine e la mette in uso', async () => {
    const uploaded = {
      ...prefs,
      appearance: { ...prefs.appearance, background: 'image' as const },
      backgroundImage: '2026-10-23T06:00:00.000Z',
    }
    const upload = vi.spyOn(source, 'uploadBackground').mockResolvedValue(uploaded)
    renderWithProviders(<AppearanceSection />)
    const file = new File([new Uint8Array([0x89, 0x50])], 'sfondo.png', { type: 'image/png' })
    fireEvent.change(await screen.findByLabelText('Immagine di sfondo'), { target: { files: [file] } })
    await waitFor(() => expect(upload).toHaveBeenCalledWith(file))
    expect(await screen.findByRole('radio', { name: 'Immagine' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('button', { name: 'Togli immagine' })).toBeInTheDocument()
  })

  it('un’immagine rifiutata mostra il motivo del server', async () => {
    vi.spyOn(source, 'uploadBackground').mockRejectedValue(
      new ApiError('file_too_large', 'Immagine oltre i 5 MB', 413),
    )
    renderWithProviders(<AppearanceSection />)
    const file = new File([new Uint8Array(4)], 'grande.jpg')
    fireEvent.change(await screen.findByLabelText('Immagine di sfondo'), { target: { files: [file] } })
    expect(await screen.findByRole('alert')).toHaveTextContent('Immagine oltre i 5 MB')
  })
})

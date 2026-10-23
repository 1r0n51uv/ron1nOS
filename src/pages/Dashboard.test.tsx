import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/test/render'
import { source } from '@/widgets/layout'
import { Dashboard } from './Dashboard'

describe('modalità modifica (DASH-009)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    vi.spyOn(source, 'getLayout').mockResolvedValue({
      device: 'desktop',
      header: 'full',
      items: [{ id: 'notes.summary', x: 0, y: 0, w: 8, h: 7 }],
      updatedAt: null,
      stored: true,
    })
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('parte fuori dalla modifica: niente comandi sui widget', async () => {
    renderWithProviders(<Dashboard />)
    await waitFor(() => expect(document.querySelector('[data-widget="notes.summary"]')).not.toBeNull())
    expect(screen.getByRole('button', { name: 'Modifica' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Sposta il widget/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Altre azioni sul widget/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Aggiungi widget' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Forma della testata' })).toBeNull()
  })

  it('Modifica mostra i comandi e Fine li toglie', async () => {
    renderWithProviders(<Dashboard />)
    fireEvent.click(await screen.findByRole('button', { name: 'Modifica' }))
    expect(await screen.findByRole('button', { name: 'Sposta il widget Nota fissata' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Ridimensiona il widget Nota fissata' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Aggiungi widget' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Forma della testata' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Fine' }))
    expect(screen.queryByRole('button', { name: /Sposta il widget/ })).toBeNull()
    expect(screen.getByRole('button', { name: 'Modifica' })).toBeTruthy()
  })
})

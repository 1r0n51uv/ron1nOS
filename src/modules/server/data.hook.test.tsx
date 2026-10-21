import { focusManager } from '@tanstack/react-query'
import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/test/render'
import { source, type ServerStats } from './data'
import { ServerWidget } from './Widget'

// Hook vero, sorgente sostituita: verifica il ciclo errore → ripresa.
const stats: ServerStats = { cpu: 10, ram: 20, disk: 30, uptimeSec: 3_600 }

afterEach(() => {
  focusManager.setFocused(undefined)
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('useServerStats con il widget', () => {
  it('passa offline quando Glances non risponde e riprende da solo', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const get = vi
      .spyOn(source, 'getServerStats')
      .mockRejectedValueOnce(new Error('503'))
      .mockRejectedValueOnce(new Error('503'))
      .mockResolvedValue(stats)

    renderWithProviders(<ServerWidget />)
    // Primo tentativo e nuovo tentativo dopo 1 s falliscono.
    await vi.advanceTimersByTimeAsync(1_100)
    expect(await screen.findByText('Glances · offline')).toBeInTheDocument()
    expect(get).toHaveBeenCalledTimes(2)

    // Al giro successivo (5 s) Glances risponde.
    await vi.advanceTimersByTimeAsync(5_000)
    expect(await screen.findByText('10%')).toBeInTheDocument()
    expect(screen.queryByText('Glances · offline')).not.toBeInTheDocument()
  })

  it('aggiorna ogni 5 s senza tornare allo skeleton', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const get = vi
      .spyOn(source, 'getServerStats')
      .mockResolvedValueOnce(stats)
      .mockResolvedValue({ ...stats, cpu: 42 })

    renderWithProviders(<ServerWidget />)
    expect(await screen.findByText('10%')).toBeInTheDocument()
    await vi.advanceTimersByTimeAsync(5_000)
    expect(await screen.findByText('42%')).toBeInTheDocument()
    expect(get).toHaveBeenCalledTimes(2)
    expect(screen.queryByLabelText('Server: caricamento')).not.toBeInTheDocument()
  })

  it('con la scheda in background non aggiorna', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const get = vi.spyOn(source, 'getServerStats').mockResolvedValue(stats)

    renderWithProviders(<ServerWidget />)
    expect(await screen.findByText('10%')).toBeInTheDocument()
    focusManager.setFocused(false)
    await vi.advanceTimersByTimeAsync(15_000)
    expect(get).toHaveBeenCalledTimes(1)
  })
})

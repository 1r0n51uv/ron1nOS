import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/test/render'
import { source, type ServerStats } from './data'
import { ServerWidget } from './Widget'

// Hook vero, sorgente sostituita: verifica il ciclo errore → ripresa.
const stats: ServerStats = { cpu: 10, ram: 20, disk: 30, uptimeSec: 3_600 }

afterEach(() => {
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
})

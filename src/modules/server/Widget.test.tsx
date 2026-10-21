import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/test/render'
import type * as data from './data'
import { useServerStats } from './data'
import { ServerWidget } from './Widget'

// Il widget legge solo dall'hook: nei test si sostituisce l'hook, non la sorgente.
vi.mock('./data', async (importOriginal) => ({
  ...(await importOriginal<typeof data>()),
  useServerStats: vi.fn(),
}))

const stats = { cpu: 23.4, ram: 57.2, disk: 82.1, tempC: 52.4, uptimeDays: 41 }

describe('ServerWidget', () => {
  it('mostra lo scheletro finché non ci sono dati', () => {
    vi.mocked(useServerStats).mockReturnValue({ data: undefined } as ReturnType<typeof useServerStats>)
    renderWithProviders(<ServerWidget />)
    expect(screen.getByLabelText('Server: caricamento')).toBeInTheDocument()
  })

  it('segnala i valori sopra soglia', () => {
    vi.mocked(useServerStats).mockReturnValue({ data: stats } as ReturnType<typeof useServerStats>)
    renderWithProviders(<ServerWidget />)
    expect(screen.getByLabelText('SSD 82%, sopra soglia')).toBeInTheDocument()
    expect(screen.getByLabelText('CPU 23%')).toBeInTheDocument()
    expect(screen.getByText('52 °C · 41 g')).toBeInTheDocument()
  })

  it('mostra CPU, RAM e SSD in percentuale intera', () => {
    vi.mocked(useServerStats).mockReturnValue({ data: stats } as ReturnType<typeof useServerStats>)
    renderWithProviders(<ServerWidget />)
    expect(screen.getByText('23%')).toBeInTheDocument()
    expect(screen.getByText('57%')).toBeInTheDocument()
    expect(screen.getByText('82%')).toBeInTheDocument()
    for (const caption of ['CPU', 'RAM', 'SSD']) expect(screen.getByText(caption)).toBeInTheDocument()
  })
})

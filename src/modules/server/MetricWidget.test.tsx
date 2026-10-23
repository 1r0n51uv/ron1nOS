import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/test/render'
import type * as data from './data'
import type { ServerStats } from './data'
import { useServerStats } from './data'
import { ServerMetricWidget } from './MetricWidget'

vi.mock('./data', async (importOriginal) => ({
  ...(await importOriginal<typeof data>()),
  useServerStats: vi.fn(),
}))

const stats: ServerStats = {
  cpu: 23.4,
  ram: 57.2,
  disk: 82.1,
  uptimeSec: 600,
  net: { rxBps: 12_400_000, txBps: 820_000 },
}
const withStats = (v: Partial<ReturnType<typeof useServerStats>>) =>
  vi
    .mocked(useServerStats)
    .mockReturnValue({ data: undefined, isError: false, ...v } as ReturnType<typeof useServerStats>)

describe('ServerMetricWidget (DASH-002)', () => {
  it('senza opzioni mostra la CPU con la barra', () => {
    withStats({ data: stats })
    renderWithProviders(<ServerMetricWidget />)
    expect(screen.getByText('CPU')).toBeInTheDocument()
    expect(screen.getByText('23%')).toBeInTheDocument()
    expect(screen.getByLabelText('CPU 23%')).toBeInTheDocument()
  })

  it('la risorsa si sceglie nelle opzioni; sopra soglia lo dice', () => {
    withStats({ data: stats })
    renderWithProviders(<ServerMetricWidget options={{ metric: 'disk' }} />)
    expect(screen.getByText('Disco')).toBeInTheDocument()
    expect(screen.getByLabelText('Disco 82%, sopra soglia')).toBeInTheDocument()
  })

  it('compatta: solo il valore', () => {
    withStats({ data: stats })
    renderWithProviders(<ServerMetricWidget variant="compact" options={{ metric: 'ram' }} />)
    expect(screen.getByText('57%')).toBeInTheDocument()
    expect(screen.queryByLabelText(/RAM 57%/)).toBeNull()
  })

  it('rete: velocità in entrata e in uscita', () => {
    withStats({ data: stats })
    renderWithProviders(<ServerMetricWidget options={{ metric: 'net' }} />)
    expect(screen.getByText(/↓ 12,4 MB\/s/)).toBeInTheDocument()
    expect(screen.getByText(/↑ 820 kB\/s/)).toBeInTheDocument()
  })

  it('con Glances giù mostra solo lo stato', () => {
    withStats({ isError: true })
    renderWithProviders(<ServerMetricWidget />)
    expect(screen.getByText('Glances · offline')).toBeInTheDocument()
  })
})

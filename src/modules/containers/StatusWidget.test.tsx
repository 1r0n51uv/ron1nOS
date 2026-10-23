import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/test/render'
import type * as data from './data'
import { useContainers } from './data'
import { ContainerStatusWidget } from './StatusWidget'

vi.mock('./data', async (importOriginal) => ({
  ...(await importOriginal<typeof data>()),
  useContainers: vi.fn(),
}))

const mockList = (list: data.Container[]) =>
  vi.mocked(useContainers).mockReturnValue({ data: list } as ReturnType<typeof useContainers>)

describe('ContainerStatusWidget (DASH-002)', () => {
  it('conta attivi e fermi', () => {
    mockList([
      { name: 'a', state: 'running' },
      { name: 'b', state: 'exited' },
    ])
    renderWithProviders(<ContainerStatusWidget />)
    expect(screen.getByText('1/2')).toBeInTheDocument()
    expect(screen.getByText('fermo')).toBeInTheDocument()
  })

  it('tutti attivi', () => {
    mockList([{ name: 'a', state: 'running' }])
    renderWithProviders(<ContainerStatusWidget />)
    expect(screen.getByText('tutti attivi')).toBeInTheDocument()
  })
})

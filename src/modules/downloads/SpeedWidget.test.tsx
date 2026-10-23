import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/test/render'
import type * as data from './data'
import { useDownloads } from './data'
import { DownloadSpeedWidget } from './SpeedWidget'

vi.mock('./data', async (importOriginal) => ({
  ...(await importOriginal<typeof data>()),
  useDownloads: vi.fn(),
}))

const torrent = (state: 'downloading' | 'seeding') => ({
  hash: Math.random().toString(36),
  name: 'a.iso',
  progress: 0.5,
  state,
  etaSeconds: 60,
  downloadSpeed: 0,
  size: 1,
})

describe('DownloadSpeedWidget (DASH-002)', () => {
  it('velocità e torrent attivi', () => {
    vi.mocked(useDownloads).mockReturnValue({
      data: {
        downloadSpeed: 4_200_000,
        torrents: [torrent('downloading'), torrent('downloading'), torrent('seeding')],
      },
      error: null,
    } as ReturnType<typeof useDownloads>)
    renderWithProviders(<DownloadSpeedWidget />)
    expect(screen.getByText('4,2')).toBeInTheDocument()
    expect(screen.getByText('MB/s')).toBeInTheDocument()
    expect(screen.getByText('attivi')).toBeInTheDocument()
  })

  it('con qBittorrent spento lo dice', () => {
    vi.mocked(useDownloads).mockReturnValue({ data: undefined, error: new Error('giù') } as ReturnType<
      typeof useDownloads
    >)
    renderWithProviders(<DownloadSpeedWidget />)
    expect(screen.getByText('qBittorrent · offline')).toBeInTheDocument()
  })
})

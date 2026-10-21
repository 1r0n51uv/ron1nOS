import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/test/render'
import type * as data from './data'
import type { Downloads, Torrent } from './data'
import { useDownloads } from './data'
import { ApiError } from '@/lib/api'
import { eta, problem, summary } from './format'
import { DownloadsWidget } from './Widget'

vi.mock('./data', async (importOriginal) => ({
  ...(await importOriginal<typeof data>()),
  useDownloads: vi.fn(),
}))

function torrent(over: Partial<Torrent>): Torrent {
  return {
    hash: Math.random().toString(36),
    name: 'file.iso',
    progress: 0.5,
    state: 'downloading',
    etaSeconds: 300,
    downloadSpeed: 0,
    size: 1,
    ...over,
  }
}

function withData(d: Downloads | undefined, error: Error | null = null) {
  vi.mocked(useDownloads).mockReturnValue({ data: d, error } as ReturnType<typeof useDownloads>)
}

describe('eta', () => {
  it.each([
    [null, 'tempo non stimabile'],
    [30, 'meno di 1 min rimanenti'],
    [180, '3 min rimanenti'],
    [3 * 3600 + 20 * 60, '3 h 20 min rimanenti'],
  ])('%s → %s', (s, text) => expect(eta(s)).toBe(text))
})

describe('summary', () => {
  it('omette le voci a zero', () => {
    expect(summary({ downloadSpeed: 0, torrents: [torrent({ state: 'seeding' })] })).toBe('1 in seed')
    expect(summary({ downloadSpeed: 0, torrents: [] })).toBe('')
  })

  it('conta gli attivi oltre i primi tre', () => {
    const torrents = [
      ...Array.from({ length: 5 }, () => torrent({})),
      torrent({ state: 'queued' }),
      torrent({ state: 'queued' }),
    ]
    expect(summary({ downloadSpeed: 0, torrents })).toBe('+2 attivi · 2 in coda')
  })
})

describe('problem', () => {
  it('distingue credenziali errate da servizio spento', () => {
    expect(problem(new ApiError('qbittorrent_auth', '', 502))).toBe('Accesso a qBittorrent non riuscito')
    expect(problem(new ApiError('qbittorrent_unreachable', '', 503))).toBe('qBittorrent non raggiungibile')
    expect(problem(new ApiError('network', '', 0))).toBe('qBittorrent non raggiungibile')
  })
})

describe('DownloadsWidget', () => {
  it('con qBittorrent spento lo dice, anche se aveva dati', () => {
    withData(
      { downloadSpeed: 1, torrents: [torrent({ name: 'vecchio.iso' })] },
      new ApiError('qbittorrent_unreachable', '', 503),
    )
    renderWithProviders(<DownloadsWidget />)
    expect(screen.getByText('qBittorrent · offline')).toBeInTheDocument()
    expect(screen.getByText('qBittorrent non raggiungibile. Riprovo ogni 5 secondi.')).toBeInTheDocument()
    expect(screen.queryByText('vecchio.iso')).not.toBeInTheDocument()
  })

  it('con credenziali errate mostra l’accesso non riuscito', () => {
    withData(undefined, new ApiError('qbittorrent_auth', '', 502))
    renderWithProviders(<DownloadsWidget />)
    expect(
      screen.getByText('Accesso a qBittorrent non riuscito. Riprovo ogni 5 secondi.'),
    ).toBeInTheDocument()
  })

  it('mostra lo scheletro al primo caricamento', () => {
    withData(undefined)
    renderWithProviders(<DownloadsWidget />)
    expect(screen.getByLabelText('Download: caricamento')).toBeInTheDocument()
  })

  it('mostra velocità e al massimo tre download attivi', () => {
    withData({
      downloadSpeed: 12_100_000,
      torrents: [
        torrent({ name: 'a.iso', progress: 0.91, etaSeconds: 40 }),
        torrent({ name: 'b.iso', progress: 0.72 }),
        torrent({ name: 'c.iso', progress: 0.31 }),
        torrent({ name: 'd.iso', progress: 0.1 }),
        torrent({ name: 'e.iso', state: 'seeding', progress: 1 }),
      ],
    })
    renderWithProviders(<DownloadsWidget />)
    expect(screen.getByText('↓ 12,1 MB/s')).toBeInTheDocument()
    const list = screen.getByRole('list', { name: 'Download in corso' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getByLabelText('a.iso 91%')).toBeInTheDocument()
    expect(screen.getByText('meno di 1 min rimanenti')).toBeInTheDocument()
    expect(screen.queryByText('d.iso')).not.toBeInTheDocument()
    expect(screen.getByText('+1 attivo · 1 in seed')).toBeInTheDocument()
  })

  it('senza download attivi lo dice e mostra il riepilogo', () => {
    withData({ downloadSpeed: 0, torrents: [torrent({ state: 'seeding', progress: 1 })] })
    renderWithProviders(<DownloadsWidget />)
    expect(screen.getByText('Nessun download attivo.')).toBeInTheDocument()
    expect(screen.getByText('1 in seed')).toBeInTheDocument()
  })
})

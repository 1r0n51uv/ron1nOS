import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/test/render'
import type * as data from '../data'
import type { YazioLink } from '../data'
import { useSetYazioSync, useSyncYazio, useYazio } from '../data'
import { YazioPanel } from './YazioPanel'

vi.mock('../data', async (importOriginal) => ({
  ...(await importOriginal<typeof data>()),
  useYazio: vi.fn(),
  useSetYazioSync: vi.fn(),
  useSyncYazio: vi.fn(),
}))

const toggle = vi.fn()
const sync = vi.fn()
const mutation = (mutate: unknown, extra = {}) =>
  ({ mutate, isPending: false, error: null, ...extra }) as never

const link = (over: Partial<YazioLink> = {}): YazioLink => ({
  configured: true,
  state: 'connected',
  error: null,
  lastSyncAt: '2026-10-21T08:12:00Z',
  syncEnabled: true,
  ...over,
})

function show(value: YazioLink) {
  vi.mocked(useYazio).mockReturnValue({ data: value, error: null } as never)
  renderWithProviders(<YazioPanel />)
}

beforeEach(() => {
  toggle.mockReset()
  sync.mockReset()
  vi.mocked(useSetYazioSync).mockReturnValue(mutation(toggle))
  vi.mocked(useSyncYazio).mockReturnValue(mutation(sync))
})

describe('YazioPanel (NUT-020)', () => {
  it('collegato: stato, ultima sincronizzazione e Sincronizza ora', () => {
    show(link())
    expect(screen.getByText('collegato')).toBeInTheDocument()
    expect(screen.getByText('21 ott 10:12')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Sincronizza ora' }))
    expect(sync).toHaveBeenCalled()
    expect(screen.getByText('Credenziali nel file .env del server.')).toBeInTheDocument()
  })

  it('errore: il motivo arriva dal server così com’è', () => {
    show(link({ state: 'error', error: 'YAZIO non raggiungibile.' }))
    expect(screen.getByText('errore')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Sincronizzazione non riuscita.YAZIO non raggiungibile.',
    )
  })

  it('l’interruttore spegne la sincronizzazione e disattiva Sincronizza ora', () => {
    show(link({ syncEnabled: false }))
    const tile = screen.getByRole('button', { name: /Sincronizzazione/ })
    expect(tile).toHaveAttribute('aria-pressed', 'false')
    expect(tile).toHaveTextContent('nessun dato si perde')
    expect(screen.getByRole('button', { name: 'Sincronizza ora' })).toBeDisabled()
    fireEvent.click(tile)
    expect(toggle).toHaveBeenCalledWith(true)
  })

  it('non configurato: niente interruttore, le istruzioni per il .env', () => {
    show(link({ configured: false, state: 'disconnected', lastSyncAt: null }))
    expect(screen.getByText('non collegato')).toBeInTheDocument()
    expect(screen.getByText('mai')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sincronizza ora' })).not.toBeInTheDocument()
    expect(screen.getByText(/Apple o Google/)).toBeInTheDocument()
  })

  it('durante un giro il pulsante aspetta', () => {
    vi.mocked(useSyncYazio).mockReturnValue(mutation(sync, { isPending: true }))
    show(link())
    expect(screen.getByRole('button', { name: 'Sincronizzo…' })).toBeDisabled()
  })
})

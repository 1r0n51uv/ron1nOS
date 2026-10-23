import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api'
import { renderWithProviders } from '@/test/render'
import type * as data from './data'
import { useDocuments } from './data'
import { summary } from './fixtures'
import { DocumentsWidget } from './Widget'

vi.mock('./data', async (importOriginal) => ({
  ...(await importOriginal<typeof data>()),
  useDocuments: vi.fn(),
}))

const show = (value: unknown, error: unknown = null) => {
  vi.mocked(useDocuments).mockReturnValue({ data: value, error } as never)
  renderWithProviders(<DocumentsWidget />)
}

beforeEach(() => vi.mocked(useDocuments).mockReset())

describe('DocumentsWidget (DOC-001)', () => {
  it('fino a 4 fissati e sotto scaduti e in scadenza entro 90 giorni', () => {
    const pinnedAt = '2026-10-01T00:00:00Z'
    show([
      ...['A', 'B', 'C', 'D', 'E'].map((t) =>
        summary({ id: t, title: t, pinnedAt, expiry: null, expiresOn: null }),
      ),
      summary({
        id: 'p',
        typeName: 'Passaporto',
        holder: 'Giulia',
        expiry: { status: 'expiring', daysLeft: 27 },
      }),
      summary({ id: 'l', typeName: 'Patente', holder: 'Mario', expiry: { status: 'expired', daysLeft: -4 } }),
      summary({ id: 'c', typeName: "Carta d'identità", expiry: { status: 'ok', daysLeft: 84 } }),
      summary({ id: 'f', typeName: 'Tessera', expiry: { status: 'ok', daysLeft: 400 } }),
    ])
    const pins = within(screen.getByRole('list', { name: 'In evidenza' })).getAllByRole('link')
    expect(pins.map((l) => l.textContent)).toEqual(['A', 'B', 'C', 'D'])
    expect(pins[0]).toHaveAttribute('href', '/documenti/A')
    const rows = within(screen.getByRole('list', { name: 'In scadenza' })).getAllByRole('listitem')
    expect(rows.map((r) => r.textContent)).toEqual([
      'Patente · MarioScaduto',
      'Passaporto · GiuliaScade tra 27 giorni',
      "Carta d'identitàScade tra 84 giorni",
    ])
    expect(screen.getByRole('link', { name: 'Dettagli' })).toHaveAttribute('href', '/documenti')
  })

  it('niente in scadenza: tutto in regola e la prossima scadenza', () => {
    show([summary({ expiry: { status: 'ok', daysLeft: 212 } })])
    expect(screen.getByText('Tutto in regola')).toBeInTheDocument()
    expect(screen.getByText(/Prossima scadenza tra/)).toHaveTextContent('Prossima scadenza tra 212 giorni')
  })

  it('vuoto: Aggiungi documento porta alla pagina', () => {
    show([])
    expect(screen.getByRole('link', { name: 'Aggiungi documento' })).toHaveAttribute('href', '/documenti')
  })

  it('modulo spento: lo dice senza errori tecnici', () => {
    show(undefined, new ApiError('documents_disabled', 'DOCUMENTS_KEY mancante o non valida', 503))
    expect(screen.getByRole('status')).toHaveTextContent('Modulo spento')
  })
})

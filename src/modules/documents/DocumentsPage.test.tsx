import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/test/render'
import type * as data from './data'
import { documentsSource, useDocuments, useDocumentTypes, useHolders } from './data'
import { DocumentsPage } from './DocumentsPage'
import { summary, types } from './fixtures'

vi.mock('./data', async (importOriginal) => ({
  ...(await importOriginal<typeof data>()),
  useDocuments: vi.fn(),
  useDocumentTypes: vi.fn(),
  useHolders: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(useDocumentTypes).mockReturnValue({ data: types } as never)
  vi.mocked(useHolders).mockReturnValue({ data: ['Io', 'Giulia'] } as never)
  vi.mocked(useDocuments).mockReturnValue({
    data: [
      summary({ id: 'a', pinnedAt: '2026-10-01T00:00:00Z', thumbFileId: 'f1', files: 1 }),
      summary({
        id: 'b',
        typeId: null,
        typeName: null,
        title: 'Contratto affitto',
        expiresOn: null,
        expiry: null,
        firstFile: { mime: 'application/pdf', size: 120_000 },
      }),
      summary({ id: 'c', title: 'Patente vecchia', expiry: { status: 'expired', daysLeft: -3 } }),
    ],
    error: null,
  } as never)
})

describe('DocumentsPage (DOC-002)', () => {
  it('in alto i fissati, poi i gruppi per tipo e File; card con titolare, tipo e scadenza', () => {
    renderWithProviders(<DocumentsPage />, { route: '/documenti' })
    expect(screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'))).toEqual([
      'In evidenza',
      "Carta d'identità",
      'File',
    ])
    const pinned = screen.getByRole('region', { name: 'In evidenza' })
    const card = within(pinned).getByRole('link')
    expect(card).toHaveAttribute('href', '/documenti/a')
    expect(card).toHaveTextContent("Io · Carta d'identitàtra 81 giorni")
    expect(card.querySelector('img')).toHaveAttribute(
      'src',
      '/api/v1/documents/documents/a/files/f1?variant=thumb',
    )
    expect(within(screen.getByRole('region', { name: 'File' })).getByRole('link')).toHaveTextContent(
      'PDF · 120 KB',
    )
    expect(screen.getByText('Scaduto')).toBeInTheDocument()
    expect(screen.getByText('Archivio · 3 documenti')).toBeInTheDocument()
  })

  it('i filtri passano al backend: tipo, titolare e ricerca', () => {
    renderWithProviders(<DocumentsPage />, { route: '/documenti?tipo=cie' })
    expect(vi.mocked(useDocuments)).toHaveBeenLastCalledWith({ q: '', type: 'cie', holder: '' })
    expect(
      screen.getByRole('group', { name: 'Tipo' }).querySelector('[aria-pressed="true"]'),
    ).toHaveTextContent("Carta d'identità")
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Titolare' })).getByRole('button', { name: 'Giulia' }),
    )
    expect(vi.mocked(useDocuments)).toHaveBeenLastCalledWith({ q: '', type: 'cie', holder: 'Giulia' })
  })

  it('la stella fissa o toglie dall’evidenza dalla pagina (DOC-008)', async () => {
    const patch = vi.spyOn(documentsSource, 'update').mockResolvedValue({} as never)
    renderWithProviders(<DocumentsPage />, { route: '/documenti' })
    fireEvent.click(screen.getByRole('button', { name: "Togli Carta d'identità dall’evidenza" }))
    await waitFor(() => expect(patch).toHaveBeenCalledWith('a', { pinned: false }))
    fireEvent.click(screen.getByRole('button', { name: 'Metti in evidenza Contratto affitto' }))
    await waitFor(() => expect(patch).toHaveBeenCalledWith('b', { pinned: true }))
  })

  it('stato vuoto e filtri senza risultati', () => {
    vi.mocked(useDocuments).mockReturnValue({ data: [], error: null } as never)
    renderWithProviders(<DocumentsPage />, { route: '/documenti' })
    expect(screen.getByText(/Nessun documento\. Carica un file/)).toBeInTheDocument()
  })
})

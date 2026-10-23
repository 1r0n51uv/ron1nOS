import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api'
import { renderWithProviders } from '@/test/render'
import type * as data from './data'
import {
  useDeleteDocument,
  useDeleteFile,
  useDocument,
  useDocumentTypes,
  useHolders,
  useUpdateDocument,
  useUpdateFile,
} from './data'
import { DocumentPage } from './DocumentPage'
import { doc, types } from './fixtures'

vi.mock('./data', async (importOriginal) => ({
  ...(await importOriginal<typeof data>()),
  useDocument: vi.fn(),
  useDocumentTypes: vi.fn(),
  useHolders: vi.fn(),
  useUpdateDocument: vi.fn(),
  useDeleteDocument: vi.fn(),
  useUpdateFile: vi.fn(),
  useDeleteFile: vi.fn(),
}))

const update = vi.fn()
const remove = vi.fn()
const writeText = vi.fn()
const mutation = (mutate: unknown) => ({ mutate, isPending: false, error: null }) as never

function show() {
  renderWithProviders(
    <Routes>
      <Route path="documenti/:id" element={<DocumentPage />} />
    </Routes>,
    { route: '/documenti/d1' },
  )
}

beforeEach(() => {
  update.mockReset()
  remove.mockReset()
  writeText.mockReset().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  vi.mocked(useDocument).mockReturnValue({ data: doc(), error: null } as never)
  vi.mocked(useDocumentTypes).mockReturnValue({ data: types } as never)
  vi.mocked(useHolders).mockReturnValue({ data: ['Io'] } as never)
  vi.mocked(useUpdateDocument).mockReturnValue(mutation(update))
  vi.mocked(useDeleteDocument).mockReturnValue(mutation(remove))
  vi.mocked(useUpdateFile).mockReturnValue(mutation(vi.fn()))
  vi.mocked(useDeleteFile).mockReturnValue(mutation(vi.fn()))
})

describe('DocumentPage (DOC-004, DOC-009)', () => {
  it('intestazione con tipo, titolare e scadenza; campi con Copia, vuoti senza', () => {
    show()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent("Carta d'identità")
    expect(screen.getByText('12/01/2027')).toBeInTheDocument()
    expect(screen.getByText('tra 81 giorni')).toBeInTheDocument()
    const fields = screen.getByRole('region', { name: 'Campi' })
    expect(within(fields).getByText('12/04/1990')).toBeInTheDocument()
    expect(within(fields).getByText('Non compilato')).toBeInTheDocument()
    expect(within(fields).queryByRole('button', { name: 'Copia Codice fiscale' })).not.toBeInTheDocument()
    expect(within(fields).getByText('viaggi')).toBeInTheDocument()
    expect(within(fields).getByText('Nel cassetto')).toBeInTheDocument()
  })

  it('Copia copia il valore e conferma con un toast; Copia tutto una riga per campo', async () => {
    show()
    fireEvent.click(screen.getByRole('button', { name: 'Copia Numero' }))
    expect(writeText).toHaveBeenCalledWith('CA00000AA')
    expect(await screen.findByRole('status')).toHaveTextContent('Copiato · Numero')
    fireEvent.click(screen.getByRole('button', { name: 'Copia Data di nascita' }))
    expect(writeText).toHaveBeenLastCalledWith('12/04/1990')
    fireEvent.click(screen.getByRole('button', { name: 'Copia tutto' }))
    expect(writeText).toHaveBeenLastCalledWith('Numero: CA00000AA\nData di nascita: 12/04/1990\nPIN: 1234')
  })

  it('allegati: anteprima dell’immagine, download con il nome originale', () => {
    show()
    const files = screen.getByRole('region', { name: 'Allegati' })
    expect(within(files).getByRole('img', { name: 'fronte.jpg' })).toHaveAttribute(
      'src',
      '/api/v1/documents/documents/d1/files/f1',
    )
    expect(within(files).getByRole('link', { name: 'Scarica' })).toHaveAttribute(
      'href',
      '/api/v1/documents/documents/d1/files/f1?download=1',
    )
    expect(within(files).getByText('2,4 MB')).toBeInTheDocument()
  })

  it('fissa, elimina con conferma', async () => {
    show()
    fireEvent.click(screen.getByRole('button', { name: 'Metti in evidenza' }))
    expect(update).toHaveBeenCalledWith({ pinned: true })
    fireEvent.click(screen.getByRole('button', { name: 'Elimina' }))
    expect(remove).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Elimina davvero' }))
    await waitFor(() => expect(remove).toHaveBeenCalledWith('d1', expect.anything()))
  })

  it('Modifica apre il form con il tipo e salva solo se il backend accetta', () => {
    show()
    fireEvent.click(screen.getByRole('button', { name: 'Modifica' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByLabelText('Tipo')).toHaveValue('cie')
    expect(within(dialog).getByLabelText('Numero')).toHaveValue('CA00000AA')
    fireEvent.change(within(dialog).getByLabelText('Tipo'), { target: { value: 'pass' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salva' }))
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ typeId: 'pass' }), expect.anything())
  })

  it('documento inesistente', () => {
    vi.mocked(useDocument).mockReturnValue({
      data: undefined,
      error: new ApiError('not_found', 'Documento non trovato', 404),
    } as never)
    show()
    expect(screen.getByText('Documento non trovato.')).toBeInTheDocument()
  })
})

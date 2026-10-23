import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type * as apiModule from '@/lib/api'
import { api, ApiError } from '@/lib/api'
import { renderWithProviders } from '@/test/render'
import type { ImportSummary } from '../data'
import { ImportDialog } from './ImportDialog'

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof apiModule>()),
  api: { get: vi.fn(), post: vi.fn() },
}))

const SUMMARY: ImportSummary = {
  newSessions: 12,
  updatedSessions: 3,
  unchangedSessions: 140,
  deletedSessions: 0,
  newSets: 200,
  updatedSets: 4,
  skippedRows: 2,
  from: '2024-03-04',
  to: '2026-10-21',
}

function open(onImported = vi.fn()) {
  renderWithProviders(
    <ImportDialog onImported={onImported}>
      <button type="button">Importa CSV</button>
    </ImportDialog>,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Importa CSV' }))
  return onImported
}

function choose(name = 'liftin.csv', content = 'Date;Exercise;Set\n2026-10-21;Squat;1') {
  fireEvent.change(screen.getByLabelText('File CSV di Liftin’'), {
    target: { files: [new File([content], name, { type: 'text/csv' })] },
  })
}

beforeEach(() => {
  vi.mocked(api.post).mockReset()
})

describe('ImportDialog', () => {
  it('mostra l anteprima del server e poi importa', async () => {
    vi.mocked(api.post).mockResolvedValue(SUMMARY)
    const onImported = open()
    expect(screen.getByRole('button', { name: 'Importa' })).toBeDisabled()
    choose()
    expect(await screen.findByText('Allenamenti nuovi')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('4 mar 2024 – 21 ott 2026')).toBeInTheDocument()
    expect(vi.mocked(api.post).mock.calls[0]![0]).toBe('/workout/import/preview')
    expect(vi.mocked(api.post).mock.calls[0]![1]).toBeInstanceOf(FormData)

    fireEvent.click(screen.getByRole('button', { name: 'Importa' }))
    await waitFor(() => expect(onImported).toHaveBeenCalledWith(SUMMARY))
    expect(vi.mocked(api.post).mock.calls[1]![0]).toBe('/workout/import')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('rifiuta un file che non è .csv senza chiamare il server', () => {
    open()
    choose('export.xlsx')
    expect(screen.getByText('Serve un file .csv esportato da Liftin’.')).toBeInTheDocument()
    expect(api.post).not.toHaveBeenCalled()
  })

  it('mostra l errore del server e non permette di importare', async () => {
    vi.mocked(api.post).mockRejectedValue(new ApiError('invalid_request', 'Colonne mancanti: Set', 400))
    open()
    choose()
    expect(await screen.findByText('Colonne mancanti: Set')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Importa' })).toBeDisabled()
  })

  it('Annulla chiude senza scrivere', async () => {
    vi.mocked(api.post).mockResolvedValue(SUMMARY)
    open()
    choose()
    await screen.findByText('Allenamenti nuovi')
    fireEvent.click(screen.getByRole('button', { name: 'Annulla' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(api.post).toHaveBeenCalledTimes(1)
  })
})

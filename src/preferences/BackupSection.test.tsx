import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api'
import { renderWithProviders } from '@/test/render'
import { BackupSection } from './BackupSection'
import { source } from './data'

const pick = (text: string) =>
  fireEvent.change(screen.getByLabelText('File di backup'), {
    target: { files: [new File([text], 'backup.json', { type: 'application/json' })] },
  })

describe('Impostazioni › Backup configurazione (SET-011)', () => {
  afterEach(() => vi.restoreAllMocks())

  it('Esporta scarica il file dal backend', () => {
    renderWithProviders(<BackupSection />)
    const link = screen.getByRole('link', { name: 'Esporta configurazione' })
    expect(link).toHaveAttribute('href', '/api/v1/preferences/export')
    expect(link).toHaveAttribute('download')
  })

  it('importare mostra cosa cambia e scrive solo dopo la conferma', async () => {
    const call = vi
      .spyOn(source, 'importBackup')
      .mockResolvedValueOnce({ changes: ['Formati', 'Dashboard · computer'], notes: [], applied: false })
      .mockResolvedValueOnce({ changes: ['Formati', 'Dashboard · computer'], notes: [], applied: true })
    renderWithProviders(<BackupSection />)
    pick('{"app":"ron1nOS"}')
    const list = await screen.findByRole('list', { name: 'Cosa cambia' })
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Formati', 'Dashboard · computer'])
    expect(call).toHaveBeenCalledWith({ app: 'ron1nOS' }, false)
    fireEvent.click(screen.getByRole('button', { name: 'Importa' }))
    await waitFor(() => expect(call).toHaveBeenLastCalledWith({ app: 'ron1nOS' }, true))
    expect(await screen.findByRole('status')).toHaveTextContent('Configurazione importata.')
  })

  it('Annulla non importa nulla', async () => {
    const call = vi
      .spyOn(source, 'importBackup')
      .mockResolvedValue({ changes: ['Aspetto'], notes: [], applied: false })
    renderWithProviders(<BackupSection />)
    pick('{}')
    fireEvent.click(await screen.findByRole('button', { name: 'Annulla' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(call).toHaveBeenCalledTimes(1)
  })

  it('un file uguale alla configurazione non chiede nulla', async () => {
    vi.spyOn(source, 'importBackup').mockResolvedValue({ changes: [], notes: [], applied: false })
    renderWithProviders(<BackupSection />)
    pick('{}')
    expect(await screen.findByRole('status')).toHaveTextContent('Niente da cambiare')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('un file non valido mostra il messaggio del backend; il testo non JSON va com’è', async () => {
    const call = vi
      .spyOn(source, 'importBackup')
      .mockRejectedValue(new ApiError('invalid_request', 'Il file non è un backup di ron1nOS', 400))
    renderWithProviders(<BackupSection />)
    pick('ciao')
    expect(await screen.findByRole('alert')).toHaveTextContent('Il file non è un backup di ron1nOS')
    expect(call).toHaveBeenCalledWith('ciao', false)
  })
})

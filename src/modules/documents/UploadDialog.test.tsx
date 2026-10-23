import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/test/render'
import { Button } from '@/components/ui/button'
import type * as data from './data'
import { documentsSource, useCreateDocument, useDocumentTypes, useHolders } from './data'
import { types } from './fixtures'
import { UploadDialog } from './UploadDialog'

vi.mock('./data', async (importOriginal) => ({
  ...(await importOriginal<typeof data>()),
  useDocumentTypes: vi.fn(),
  useHolders: vi.fn(),
  useCreateDocument: vi.fn(),
}))

const create = vi.fn()

function open() {
  renderWithProviders(
    <UploadDialog>
      <Button>Carica file</Button>
    </UploadDialog>,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Carica file' }))
  return screen.getByRole('dialog')
}

const choose = (dialog: HTMLElement, ...files: File[]) =>
  fireEvent.change(within(dialog).getByLabelText('Scegli i file'), { target: { files } })

beforeEach(() => {
  create.mockReset().mockResolvedValue({ id: 'new' })
  vi.mocked(useDocumentTypes).mockReturnValue({ data: types } as never)
  vi.mocked(useHolders).mockReturnValue({ data: ['Io'] } as never)
  vi.mocked(useCreateDocument).mockReturnValue({
    mutateAsync: create,
    isPending: false,
    error: null,
  } as never)
})

describe('UploadDialog (DOC-005, DOC-011)', () => {
  it('documento: etichette fronte e retro, tipo scelto, form con i campi del tipo', async () => {
    const upload = vi.spyOn(documentsSource, 'upload').mockResolvedValue({} as never)
    const dialog = open()
    choose(dialog, new File(['a'], 'a.jpg'), new File(['b'], 'b.jpg'), new File(['c'], 'c.jpg'))
    expect(within(dialog).getByLabelText('Etichetta di a.jpg')).toHaveValue('fronte')
    expect(within(dialog).getByLabelText('Etichetta di b.jpg')).toHaveValue('retro')
    expect(within(dialog).getByLabelText('Etichetta di c.jpg')).toHaveValue('pagina')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Togli c.jpg' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Passaporto' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Continua' }))

    expect(within(dialog).getByLabelText('Titolo')).toHaveValue('Passaporto')
    fireEvent.change(within(dialog).getByLabelText('Numero'), { target: { value: 'YA1' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salva' }))
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(2))
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ typeId: 'pass', title: 'Passaporto', fields: { number: 'YA1' } }),
    )
    expect(upload.mock.calls.map((c) => [c[0], (c[1] as File).name, c[2]])).toEqual([
      ['new', 'a.jpg', 'fronte'],
      ['new', 'b.jpg', 'retro'],
    ])
  })

  it('file libero: titolo dal nome del file, nessun campo', () => {
    const dialog = open()
    choose(dialog, new File(['%PDF'], 'Polizza auto.pdf'))
    fireEvent.click(within(dialog).getByRole('button', { name: /File libero/ }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Continua' }))
    expect(within(dialog).getByLabelText('Titolo')).toHaveValue('Polizza auto')
    expect(within(dialog).queryByRole('region', { name: 'Campi liberi' })).not.toBeInTheDocument()
    expect(within(dialog).queryByLabelText('Titolare')).not.toBeInTheDocument()
  })

  it('un file che non si carica non blocca gli altri e il documento resta', async () => {
    vi.spyOn(documentsSource, 'upload')
      .mockRejectedValueOnce(new Error('rete'))
      .mockResolvedValueOnce({} as never)
    const dialog = open()
    choose(dialog, new File(['a'], 'a.pdf'), new File(['b'], 'b.pdf'))
    fireEvent.click(within(dialog).getByRole('button', { name: /File con info/ }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Continua' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salva' }))
    expect(await within(dialog).findByText('Alcuni file non sono stati caricati.')).toBeInTheDocument()
    expect(within(dialog).getByText('Backend non raggiungibile')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Apri documento' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Riprova' })).toBeInTheDocument()
  })

  it('oltre 20 MB il file è segnalato e non si carica', () => {
    const dialog = open()
    const big = new File(['x'], 'grande.zip')
    Object.defineProperty(big, 'size', { value: 21 * 1024 * 1024 })
    choose(dialog, big)
    expect(within(dialog).getByText('Oltre i 20 MB: non verrà caricato.')).toBeInTheDocument()
  })
})

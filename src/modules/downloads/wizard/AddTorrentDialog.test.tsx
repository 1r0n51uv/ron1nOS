import { fireEvent, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type * as apiModule from '@/lib/api'
import { api, ApiError } from '@/lib/api'
import { renderWithProviders } from '@/test/render'
import type { Draft } from '../data'
import { AddTorrentDialog } from './AddTorrentDialog'

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof apiModule>()),
  api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}))

const DRAFT: Draft = {
  id: 'd1',
  source: 'file',
  status: 'ready',
  infoHash: 'a'.repeat(40),
  name: 'debian-13.1.0-amd64-DVD',
  size: 7_900_002_000,
  files: [
    { index: 0, path: 'debian-13.1.0-amd64-DVD/debian-13.1.0-amd64-DVD-1.iso', size: 3_900_000_000 },
    { index: 1, path: 'debian-13.1.0-amd64-DVD/debian-13.1.0-amd64-DVD-2.iso', size: 4_000_000_000 },
    { index: 2, path: 'debian-13.1.0-amd64-DVD/SHA256SUMS', size: 1_000 },
    { index: 3, path: 'debian-13.1.0-amd64-DVD/SHA256SUMS.sign', size: 1_000 },
  ],
}

function open() {
  renderWithProviders(
    <AddTorrentDialog>
      <button type="button">Aggiungi</button>
    </AddTorrentDialog>,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Aggiungi' }))
  return screen.getByRole('dialog')
}

const avanti = () => screen.getByRole('button', { name: 'Avanti' })

function chooseFile(name = 'debian.torrent', content = 'd4:infod4:name1:aee') {
  fireEvent.change(screen.getByLabelText('File .torrent'), {
    target: { files: [new File([content], name, { type: 'application/x-bittorrent' })] },
  })
}

beforeEach(() => {
  vi.mocked(api.post).mockReset()
  vi.mocked(api.get).mockReset()
})

const HASH = '3b1a1469c180f447b77021074dbbccaef62611e7'

function magnet(over: Partial<Draft> = {}): Draft {
  return {
    ...DRAFT,
    source: 'magnet',
    status: 'metadata',
    infoHash: HASH,
    name: HASH,
    size: 0,
    files: [],
    metadata: { peers: 3, waitedSeconds: 18, limitSeconds: 60 },
    ...over,
  }
}

function sendMagnet() {
  open()
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Link' }))
  fireEvent.change(screen.getByLabelText('Link magnet o URL di un .torrent'), {
    target: { value: `magnet:?xt=urn:btih:${HASH}` },
  })
  fireEvent.click(avanti())
}

describe('Passo 1: sorgente', () => {
  it('parte dalla scheda File con Avanti disattivato', () => {
    const dialog = open()
    expect(within(dialog).getByRole('tab', { name: 'File' })).toHaveAttribute('aria-selected', 'true')
    expect(within(dialog).getByText('Trascina qui un file .torrent')).toBeInTheDocument()
    expect(avanti()).toBeDisabled()
  })

  it('un file .torrent attiva Avanti', () => {
    open()
    chooseFile()
    expect(screen.getByText('debian.torrent')).toBeInTheDocument()
    expect(avanti()).toBeEnabled()
  })

  it('un file che non è un torrent mostra l’errore', () => {
    open()
    chooseFile('foto.jpg')
    expect(screen.getByText('File torrent non valido.')).toBeInTheDocument()
    expect(avanti()).toBeDisabled()
  })

  it('nella scheda Link riconosce magnet e URL', () => {
    open()
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Link' }))
    const field = screen.getByLabelText('Link magnet o URL di un .torrent')
    fireEvent.change(field, { target: { value: 'ciao' } })
    expect(screen.getByText('Link non valido.')).toBeInTheDocument()
    expect(avanti()).toBeDisabled()
    fireEvent.change(field, {
      target: { value: 'magnet:?xt=urn:btih:3b1a1469c180f447b77021074dbbccaef62611e7' },
    })
    expect(screen.getByText('magnet · v1')).toBeInTheDocument()
    expect(avanti()).toBeEnabled()
  })

  it('un link incollato fuori dal campo apre la scheda Link', () => {
    const dialog = open()
    fireEvent.paste(dialog, { clipboardData: { getData: () => 'https://example.com/d.torrent' } })
    expect(screen.getByRole('tab', { name: 'Link' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByLabelText('Link magnet o URL di un .torrent')).toHaveValue(
      'https://example.com/d.torrent',
    )
    expect(screen.getByText('URL di un file .torrent')).toBeInTheDocument()
  })
})

describe('Passo 2: contenuti', () => {
  it('con un file mostra subito nome, numero di file e dimensione', async () => {
    vi.mocked(api.post).mockResolvedValue(DRAFT)
    open()
    chooseFile()
    fireEvent.click(avanti())
    expect(await screen.findByText('debian-13.1.0-amd64-DVD')).toBeInTheDocument()
    expect(screen.getByText('4 file · 7,9 GB')).toBeInTheDocument()
    expect(screen.getByText('AGGIUNGI TORRENT · 2 DI 4')).toBeInTheDocument()
    const [path, body] = vi.mocked(api.post).mock.calls[0]
    expect(path).toBe('/downloads/drafts')
    expect((body as FormData).get('file')).toBeInstanceOf(File)
  })

  it('URL non scaricabile: errore e Indietro mantiene il link', async () => {
    vi.mocked(api.post).mockRejectedValue(new ApiError('torrent_fetch_failed', '', 422))
    open()
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Link' }))
    fireEvent.change(screen.getByLabelText('Link magnet o URL di un .torrent'), {
      target: { value: 'https://example.com/d.torrent' },
    })
    fireEvent.click(avanti())
    expect(await screen.findByText('Impossibile scaricare il file torrent.')).toBeInTheDocument()
    expect(api.post).toHaveBeenCalledWith('/downloads/drafts', { link: 'https://example.com/d.torrent' })

    const alert = screen.getByText('Impossibile scaricare il file torrent.').closest('[role="status"]')!
    fireEvent.click(within(alert as HTMLElement).getByRole('button', { name: 'Indietro' }))
    expect(screen.getByLabelText('Link magnet o URL di un .torrent')).toHaveValue(
      'https://example.com/d.torrent',
    )
  })
})

describe('Passo 2: magnet', () => {
  it('mostra l’attesa dei metadati con peer e tempo', async () => {
    vi.mocked(api.post).mockResolvedValue(magnet())
    vi.mocked(api.get).mockResolvedValue(magnet())
    sendMagnet()
    expect(await screen.findByText('Recupero dei metadati…')).toBeInTheDocument()
    expect(screen.getByText('3 peer')).toBeInTheDocument()
    expect(screen.getByText('0:18 su 1:00')).toBeInTheDocument()
    expect(screen.getByText(`magnet · ${HASH}`)).toBeInTheDocument()
    expect(avanti()).toBeDisabled()
  })

  it('quando arrivano i metadati mostra i contenuti', async () => {
    vi.mocked(api.post).mockResolvedValue(magnet())
    vi.mocked(api.get).mockResolvedValue({ ...DRAFT, source: 'magnet', infoHash: HASH })
    sendMagnet()
    expect(await screen.findByText('4 file · 7,9 GB')).toBeInTheDocument()
    expect(api.get).toHaveBeenCalledWith('/downloads/drafts/d1')
  })

  it('dopo l’attesa propone Riprova', async () => {
    const timeout = magnet({ status: 'timeout', metadata: { peers: 0, waitedSeconds: 60, limitSeconds: 60 } })
    vi.mocked(api.post).mockResolvedValueOnce(timeout).mockResolvedValueOnce(magnet())
    vi.mocked(api.get).mockResolvedValue(timeout)
    sendMagnet()
    expect(await screen.findByText('Nessun peer ha fornito i metadati.')).toBeInTheDocument()
    expect(screen.getByText('Attesi 60 secondi. Puoi riprovare per altri 60.')).toBeInTheDocument()
    vi.mocked(api.get).mockResolvedValue(magnet())
    fireEvent.click(screen.getByRole('button', { name: 'Riprova' }))
    expect(await screen.findByText('Recupero dei metadati…')).toBeInTheDocument()
    expect(api.post).toHaveBeenLastCalledWith('/downloads/drafts/d1/retry')
  })

  it('un duplicato ferma il wizard con nome e stato', async () => {
    vi.mocked(api.post).mockRejectedValue(
      new ApiError('duplicate', '', 409, { torrent: { name: 'debian-13.1.0-amd64-DVD', state: 'seeding' } }),
    )
    sendMagnet()
    expect(await screen.findByText('Questo torrent è già nei download.')).toBeInTheDocument()
    expect(screen.getByText('debian-13.1.0-amd64-DVD · in seed')).toBeInTheDocument()
    expect(avanti()).toBeDisabled()
  })
})

describe('Passo 3: scelta dei file', () => {
  async function toFiles(draft: Draft = DRAFT) {
    vi.mocked(api.post).mockResolvedValue(draft)
    open()
    chooseFile()
    fireEvent.click(avanti())
    await screen.findByText(`${draft.files.length} file · ${draft.files.length > 1 ? '7,9 GB' : '700 B'}`)
    fireEvent.click(avanti())
    return screen.getByRole('list', { name: 'File del torrent' })
  }

  const box = (name: string) => screen.getByRole('checkbox', { name })

  it('parte con tutti i file scelti e mostra il totale', async () => {
    const list = await toFiles()
    expect(screen.getByText('AGGIUNGI TORRENT · 3 DI 4')).toBeInTheDocument()
    expect(screen.getByText('debian-13.1.0-amd64-DVD · 4 file · 7,9 GB')).toBeInTheDocument()
    expect(within(list).getAllByRole('checkbox')).toHaveLength(5)
    expect(box('debian-13.1.0-amd64-DVD')).toHaveAttribute('data-state', 'checked')
    expect(screen.getByText('4 file · 7,9 GB su 7,9 GB')).toBeInTheDocument()
    expect(avanti()).toBeEnabled()
  })

  it('togliere un file rende parziale la cartella', async () => {
    await toFiles()
    fireEvent.click(box('debian-13.1.0-amd64-DVD-2.iso'))
    expect(box('debian-13.1.0-amd64-DVD-2.iso')).toHaveAttribute('data-state', 'unchecked')
    expect(box('debian-13.1.0-amd64-DVD')).toHaveAttribute('data-state', 'indeterminate')
    expect(screen.getByText('3 file · 3,9 GB su 7,9 GB')).toBeInTheDocument()
  })

  it('la cartella sceglie o toglie tutto il contenuto', async () => {
    await toFiles()
    fireEvent.click(box('debian-13.1.0-amd64-DVD'))
    expect(screen.getByText('0 file · 0 B su 7,9 GB')).toBeInTheDocument()
    expect(avanti()).toBeDisabled()
    fireEvent.click(box('debian-13.1.0-amd64-DVD'))
    expect(screen.getByText('4 file · 7,9 GB su 7,9 GB')).toBeInTheDocument()
  })

  it('Nessuno e Tutti', async () => {
    await toFiles()
    fireEvent.click(screen.getByRole('button', { name: 'Nessuno' }))
    expect(avanti()).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Tutti' }))
    expect(screen.getByText('4 file · 7,9 GB su 7,9 GB')).toBeInTheDocument()
  })

  it('Indietro e Avanti mantengono la scelta', async () => {
    await toFiles()
    fireEvent.click(box('SHA256SUMS.sign'))
    fireEvent.click(screen.getByRole('button', { name: 'Indietro' }))
    expect(screen.getByText('AGGIUNGI TORRENT · 2 DI 4')).toBeInTheDocument()
    fireEvent.click(avanti())
    expect(box('SHA256SUMS.sign')).toHaveAttribute('data-state', 'unchecked')
  })

  it('con un solo file è già scelto e si prosegue subito', async () => {
    await toFiles({ ...DRAFT, name: 'a.iso', size: 700, files: [{ index: 0, path: 'a.iso', size: 700 }] })
    expect(box('a.iso')).toHaveAttribute('data-state', 'checked')
    expect(avanti()).toBeEnabled()
  })
})

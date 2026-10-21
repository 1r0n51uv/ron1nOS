// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

import { DEBIAN_DVD } from '../e2e/torrents.ts'
import {
  createDraftService,
  createDraftStore,
  DRAFT_TAG,
  DraftNotFoundError,
  DuplicateTorrentError,
  InsufficientSpaceError,
  InvalidMagnetError,
  InvalidSelectionError,
  StartFailedError,
} from './drafts.ts'
import { fakeQbt, qbtTorrent } from './testing/fake-qbt.ts'
import { parseTorrent } from './torrentfile.ts'

const HASH = '3b1a1469c180f447b77021074dbbccaef62611e7'
const MAGNET = `magnet:?xt=urn:btih:${HASH}&dn=debian-13.iso`

describe('createDraftStore', () => {
  it('le bozze scadono dopo 30 minuti', () => {
    let t = 0
    const store = createDraftStore({ now: () => t })
    const { draft } = store.add({ source: 'file', status: 'ready', ...parseTorrent(DEBIAN_DVD) }, DEBIAN_DVD)
    t = 29 * 60_000
    expect(store.get(draft.id)?.torrent).toBe(DEBIAN_DVD)
    t = 31 * 60_000
    expect(store.get(draft.id)).toBeUndefined()
  })
})

describe('createDraftService · file', () => {
  it('una bozza da file non tocca qBittorrent', async () => {
    const qbt = fakeQbt({}, [])
    const draft = await createDraftService({ qbt }).fromTorrent('file', DEBIAN_DVD)
    expect(draft).toMatchObject({ source: 'file', status: 'ready', name: 'debian-13.1.0-amd64-DVD' })
    expect(qbt.add).not.toHaveBeenCalled()
  })

  it('un torrent già presente ferma il wizard', async () => {
    const { infoHash } = parseTorrent(DEBIAN_DVD)
    const qbt = fakeQbt({}, [qbtTorrent({ hash: infoHash, name: 'debian-dvd', state: 'uploading' })])
    const err = await createDraftService({ qbt })
      .fromTorrent('file', DEBIAN_DVD)
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(DuplicateTorrentError)
    expect((err as DuplicateTorrentError).torrent).toEqual({ name: 'debian-dvd', state: 'seeding' })
  })

  it('una bozza magnet abbandonata dello stesso torrent viene tolta', async () => {
    const { infoHash } = parseTorrent(DEBIAN_DVD)
    const qbt = fakeQbt({}, [qbtTorrent({ hash: infoHash, tags: DRAFT_TAG })])
    await createDraftService({ qbt }).fromTorrent('file', DEBIAN_DVD)
    expect(qbt.delete).toHaveBeenCalledWith(infoHash, true)
  })
})

describe('createDraftService · magnet', () => {
  it('aggiunge il magnet fermo ai metadati, con il tag delle bozze', async () => {
    const qbt = fakeQbt({}, [])
    const draft = await createDraftService({ qbt }).fromMagnet(MAGNET)
    expect(qbt.add).toHaveBeenCalledWith({
      magnet: MAGNET,
      stopCondition: 'MetadataReceived',
      tags: DRAFT_TAG,
    })
    expect(draft).toMatchObject({
      source: 'magnet',
      status: 'metadata',
      infoHash: HASH,
      name: 'debian-13.iso',
    })
  })

  it('attende i metadati, poi restituisce i file', async () => {
    let t = 0
    const list = [
      qbtTorrent({ hash: HASH, name: 'debian-13.iso', tags: DRAFT_TAG, num_seeds: 2, num_leechs: 1 }),
    ]
    const files = vi.fn().mockResolvedValue([])
    const service = createDraftService({ qbt: fakeQbt({ files }, list), now: () => t })
    const { id } = await service.fromMagnet(MAGNET)

    t = 18_000
    expect(await service.get(id)).toMatchObject({
      status: 'metadata',
      metadata: { peers: 3, waitedSeconds: 18, limitSeconds: 60 },
    })

    files.mockResolvedValue([{ index: 0, name: 'debian-13.iso', size: 700 }])
    expect(await service.get(id)).toMatchObject({
      status: 'ready',
      size: 700,
      files: [{ index: 0, path: 'debian-13.iso', size: 700 }],
    })
  })

  it('dopo 60 secondi va in timeout; Riprova dà altri 60 secondi', async () => {
    let t = 0
    const service = createDraftService({
      qbt: fakeQbt({}, [qbtTorrent({ hash: HASH, tags: DRAFT_TAG })]),
      now: () => t,
    })
    const { id } = await service.fromMagnet(MAGNET)
    t = 60_000
    expect(await service.get(id)).toMatchObject({ status: 'timeout' })
    t = 61_000
    expect(await service.retry(id)).toMatchObject({ status: 'metadata', metadata: { waitedSeconds: 0 } })
  })

  it('riprende una bozza magnet già in qBittorrent invece di aggiungerla', async () => {
    const qbt = fakeQbt({}, [qbtTorrent({ hash: HASH, tags: DRAFT_TAG })])
    await createDraftService({ qbt }).fromMagnet(MAGNET)
    expect(qbt.add).not.toHaveBeenCalled()
  })

  it('un magnet già nei download ferma il wizard senza aggiungere nulla', async () => {
    const qbt = fakeQbt({}, [qbtTorrent({ hash: HASH, tags: '' })])
    await expect(createDraftService({ qbt }).fromMagnet(MAGNET)).rejects.toBeInstanceOf(DuplicateTorrentError)
    expect(qbt.add).not.toHaveBeenCalled()
  })

  it('un magnet senza hash è rifiutato', async () => {
    await expect(createDraftService({ qbt: fakeQbt() }).fromMagnet('magnet:?dn=x')).rejects.toBeInstanceOf(
      InvalidMagnetError,
    )
  })

  it('se il torrent sparisce da qBittorrent la bozza non c’è più', async () => {
    const qbt = fakeQbt({ files: vi.fn().mockResolvedValue(null) }, [])
    const service = createDraftService({ qbt })
    vi.mocked(qbt.files).mockResolvedValueOnce([])
    const { id } = await service.fromMagnet(MAGNET)
    await expect(service.get(id)).rejects.toBeInstanceOf(DraftNotFoundError)
    await expect(service.get(id)).rejects.toBeInstanceOf(DraftNotFoundError)
  })
})

describe('createDraftService · avvio', () => {
  const meta = parseTorrent(DEBIAN_DVD)

  async function fileDraft(over = {}) {
    const files = vi.fn().mockResolvedValue([])
    const qbt = fakeQbt({ files, ...over }, [])
    const service = createDraftService({ qbt, addWaitMs: 50 })
    const draft = await service.fromTorrent('file', DEBIAN_DVD)
    return { qbt, service, draft }
  }

  it('aggiunge il .torrent fermo, esclude i file non scelti, toglie il tag e avvia', async () => {
    const { qbt, service, draft } = await fileDraft()
    await expect(service.start(draft.id, [0, 2, 3])).resolves.toEqual({ hash: meta.infoHash })
    expect(qbt.add).toHaveBeenCalledWith({ torrent: DEBIAN_DVD, stopped: true, tags: DRAFT_TAG })
    expect(qbt.filePrio).toHaveBeenCalledWith(meta.infoHash, [1], 0)
    expect(qbt.removeTags).toHaveBeenCalledWith(meta.infoHash, DRAFT_TAG)
    expect(qbt.start).toHaveBeenCalledWith(meta.infoHash)
    // La bozza è consumata.
    await expect(service.get(draft.id)).rejects.toBeInstanceOf(DraftNotFoundError)
  })

  it('con tutti i file non chiama filePrio', async () => {
    const { qbt, service, draft } = await fileDraft()
    await service.start(draft.id, [0, 1, 2, 3])
    expect(qbt.filePrio).not.toHaveBeenCalled()
  })

  it('rifiuta una scelta vuota o con indici sconosciuti', async () => {
    const { service, draft } = await fileDraft()
    await expect(service.start(draft.id, [])).rejects.toBeInstanceOf(InvalidSelectionError)
    await expect(service.start(draft.id, [9])).rejects.toBeInstanceOf(InvalidSelectionError)
  })

  it('senza spazio non aggiunge nulla', async () => {
    const { qbt, service, draft } = await fileDraft({ freeSpace: vi.fn(async () => 1_000) })
    const err = await service.start(draft.id, [0]).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(InsufficientSpaceError)
    expect(err).toMatchObject({ needed: 3_900_000_000, free: 1_000 })
    expect(qbt.add).not.toHaveBeenCalled()
  })

  it('un errore a metà toglie il torrent aggiunto', async () => {
    const { qbt, service, draft } = await fileDraft({ start: vi.fn().mockRejectedValue(new Error('no')) })
    await expect(service.start(draft.id, [0])).rejects.toBeInstanceOf(StartFailedError)
    expect(qbt.delete).toHaveBeenCalledWith(meta.infoHash, true)
    // La bozza resta: si può riprovare.
    await expect(service.get(draft.id)).resolves.toMatchObject({ status: 'ready' })
  })

  it('se qBittorrent non registra il torrent l’avvio fallisce e si ripulisce', async () => {
    const { qbt, service, draft } = await fileDraft({ files: vi.fn().mockResolvedValue(null) })
    await expect(service.start(draft.id, [0])).rejects.toBeInstanceOf(StartFailedError)
    expect(qbt.delete).toHaveBeenCalled()
  })

  it('un magnet pronto non viene riaggiunto; se fallisce torna bozza', async () => {
    const files = vi.fn().mockResolvedValue([
      { index: 0, name: 'a', size: 1 },
      { index: 1, name: 'b', size: 1 },
    ])
    const qbt = fakeQbt({ files, start: vi.fn().mockRejectedValue(new Error('no')) }, [
      qbtTorrent({ hash: HASH, tags: DRAFT_TAG }),
    ])
    const service = createDraftService({ qbt })
    const draft = await service.fromMagnet(MAGNET)
    await expect(service.start(draft.id, [1])).rejects.toBeInstanceOf(StartFailedError)
    expect(qbt.add).not.toHaveBeenCalled()
    expect(qbt.filePrio).toHaveBeenCalledWith(HASH, [0], 0)
    expect(qbt.addTags).toHaveBeenCalledWith(HASH, DRAFT_TAG)
    expect(qbt.delete).not.toHaveBeenCalled()
  })
})

describe('createDraftService · annulla', () => {
  it('una bozza magnet esce da qBittorrent con i file', async () => {
    const qbt = fakeQbt({}, [qbtTorrent({ hash: HASH, tags: DRAFT_TAG })])
    const service = createDraftService({ qbt })
    const { id } = await service.fromMagnet(MAGNET)
    await service.discard(id)
    expect(qbt.delete).toHaveBeenCalledWith(HASH, true)
    await expect(service.get(id)).rejects.toBeInstanceOf(DraftNotFoundError)
  })

  it('non tocca un torrent che non è più una bozza', async () => {
    const list = [qbtTorrent({ hash: HASH, tags: DRAFT_TAG })]
    const qbt = fakeQbt({}, list)
    const service = createDraftService({ qbt })
    const { id } = await service.fromMagnet(MAGNET)
    list[0].tags = ''
    await service.discard(id)
    expect(qbt.delete).not.toHaveBeenCalled()
  })

  it('una bozza da file non chiama qBittorrent', async () => {
    const qbt = fakeQbt({}, [])
    const service = createDraftService({ qbt })
    const { id } = await service.fromTorrent('file', DEBIAN_DVD)
    await service.discard(id)
    expect(qbt.delete).not.toHaveBeenCalled()
    await service.discard('sconosciuta')
  })

  it('toglie le bozze orfane più vecchie di 30 minuti', async () => {
    const now = 1_000_000_000_000
    const qbt = fakeQbt({}, [])
    vi.mocked(qbt.torrents).mockResolvedValue([
      qbtTorrent({ hash: 'vecchia', tags: DRAFT_TAG, added_on: (now - 31 * 60_000) / 1000 }),
      qbtTorrent({ hash: 'nuova', tags: DRAFT_TAG, added_on: (now - 5 * 60_000) / 1000 }),
    ])
    await expect(createDraftService({ qbt, now: () => now }).sweepOrphans()).resolves.toBe(1)
    expect(qbt.torrents).toHaveBeenCalledWith({ tag: DRAFT_TAG })
    expect(qbt.delete).toHaveBeenCalledWith('vecchia', true)
    expect(qbt.delete).toHaveBeenCalledTimes(1)
  })
})

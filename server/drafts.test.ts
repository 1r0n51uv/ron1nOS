// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

import { DEBIAN_DVD } from '../e2e/torrents.ts'
import {
  createDraftService,
  createDraftStore,
  DRAFT_TAG,
  DraftNotFoundError,
  DuplicateTorrentError,
  InvalidMagnetError,
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

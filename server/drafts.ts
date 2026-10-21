// Bozze del wizard Aggiungi: un torrent letto ma non ancora avviato.
// Da file o URL la bozza sta solo in memoria e qBittorrent non ne sa
// nulla; da magnet il torrent è già in qBittorrent, fermo appena arrivano
// i metadati e marcato con il tag DRAFT_TAG.
import { randomUUID } from 'node:crypto'

import { DRAFT_TAG, isDraft, mapState, type TorrentState } from './downloads.ts'
import { parseMagnet } from './magnet.ts'
import type { QbtClient } from './qbittorrent.ts'
import type { TorrentFile, TorrentMeta } from './torrentfile.ts'
import { parseTorrent } from './torrentfile.ts'

export { DRAFT_TAG }
export const DRAFT_TTL_MS = 30 * 60_000
export const METADATA_WAIT_MS = 60_000

export type DraftSource = 'file' | 'url' | 'magnet'

// Come in api/openapi.yaml (schema Draft).
export type Draft = {
  id: string
  source: DraftSource
  // ready: file noti · metadata: magnet in attesa dei peer · timeout: attesa finita
  status: 'ready' | 'metadata' | 'timeout'
  infoHash: string
  name: string
  size: number
  files: TorrentFile[]
  metadata?: { peers: number; waitedSeconds: number; limitSeconds: number }
}

export type DraftEntry = {
  draft: Draft
  torrent: Buffer | null // il .torrent, solo per file e URL
  createdAt: number
  waitFrom: number // inizio dell'attesa dei metadati in corso
}

export class DraftNotFoundError extends Error {}
export class InvalidMagnetError extends Error {}
export class InvalidSelectionError extends Error {}
export class StartFailedError extends Error {}

export class InsufficientSpaceError extends Error {
  readonly needed: number
  readonly free: number
  constructor(needed: number, free: number) {
    super('Spazio insufficiente')
    this.needed = needed
    this.free = free
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export class DuplicateTorrentError extends Error {
  readonly torrent: { name: string; state: TorrentState }
  constructor(torrent: { name: string; state: TorrentState }) {
    super('Questo torrent è già nei download')
    this.torrent = torrent
  }
}

export type DraftStore = ReturnType<typeof createDraftStore>

export function createDraftStore({ now = Date.now, ttlMs = DRAFT_TTL_MS } = {}) {
  const entries = new Map<string, DraftEntry>()

  function sweep() {
    const limit = now() - ttlMs
    for (const [id, e] of entries) if (e.createdAt < limit) entries.delete(id)
  }

  return {
    add(draft: Omit<Draft, 'id'>, torrent: Buffer | null): DraftEntry {
      sweep()
      const entry = { draft: { id: randomUUID(), ...draft }, torrent, createdAt: now(), waitFrom: now() }
      entries.set(entry.draft.id, entry)
      return entry
    },
    get(id: string) {
      sweep()
      return entries.get(id)
    },
    delete(id: string) {
      return entries.delete(id)
    },
    sweep,
  }
}

export type DraftService = ReturnType<typeof createDraftService>

export function createDraftService({
  qbt,
  now = Date.now,
  store = createDraftStore({ now }),
  metadataWaitMs = METADATA_WAIT_MS,
  addWaitMs = 10_000,
}: {
  qbt: QbtClient
  store?: DraftStore
  now?: () => number
  metadataWaitMs?: number
  // Quanto aspettare che qBittorrent registri un .torrent appena aggiunto.
  addWaitMs?: number
}) {
  // Un torrent già in qBittorrent ferma il wizard, tranne le bozze
  // lasciate da un wizard precedente: quelle si riprendono.
  async function existing(infoHash: string) {
    const [found] = await qbt.torrents({ hashes: [infoHash] })
    if (!found) return null
    if (isDraft(found)) return found
    throw new DuplicateTorrentError({ name: found.name, state: mapState(found.state) })
  }

  async function fromTorrent(
    source: 'file' | 'url',
    torrent: Buffer,
    meta: TorrentMeta = parseTorrent(torrent),
  ) {
    const old = await existing(meta.infoHash)
    if (old) await qbt.delete(meta.infoHash, true)
    return store.add({ source, status: 'ready', ...meta }, torrent).draft
  }

  async function fromMagnet(link: string) {
    const magnet = parseMagnet(link)
    if (!magnet) throw new InvalidMagnetError()
    const old = await existing(magnet.infoHash)
    if (!old) {
      await qbt.add({ magnet: link, stopCondition: 'MetadataReceived', tags: DRAFT_TAG })
    }
    const entry = store.add(
      {
        source: 'magnet',
        status: 'metadata',
        infoHash: magnet.infoHash,
        name: magnet.name ?? magnet.infoHash,
        size: 0,
        files: [],
      },
      null,
    )
    return read(entry)
  }

  // Le bozze da magnet chiedono a qBittorrent se i metadati sono arrivati.
  async function read(entry: DraftEntry): Promise<Draft> {
    const { draft } = entry
    if (draft.status === 'ready') return draft
    const files = await qbt.files(draft.infoHash)
    if (files === null) {
      store.delete(draft.id)
      throw new DraftNotFoundError()
    }
    const [info] = await qbt.torrents({ hashes: [draft.infoHash] })
    if (files.length) {
      entry.draft = {
        ...draft,
        status: 'ready',
        name: info?.name ?? draft.name,
        size: files.reduce((s, f) => s + f.size, 0),
        files: files.map((f) => ({ index: f.index, path: f.name, size: f.size })),
        metadata: undefined,
      }
      return entry.draft
    }
    const waited = now() - entry.waitFrom
    entry.draft = {
      ...draft,
      status: waited >= metadataWaitMs ? 'timeout' : 'metadata',
      metadata: {
        peers: info ? info.num_seeds + info.num_leechs : 0,
        waitedSeconds: Math.floor(Math.min(metadataWaitMs, waited) / 1000),
        limitSeconds: metadataWaitMs / 1000,
      },
    }
    return entry.draft
  }

  function entry(id: string) {
    const e = store.get(id)
    if (!e) throw new DraftNotFoundError()
    return e
  }

  // qBittorrent aggiunge i torrent in modo asincrono: si aspetta che
  // compaia prima di toccarne i file.
  async function waitAdded(hash: string) {
    const until = Date.now() + addWaitMs
    for (;;) {
      if ((await qbt.files(hash)) !== null) return
      if (Date.now() > until) throw new StartFailedError('torrent non registrato da qBittorrent')
      await sleep(200)
    }
  }

  // Avvio (DL-007): solo i file scelti. Un .torrent entra in qBittorrent
  // solo qui, fermo e con il tag delle bozze, così un errore a metà si
  // ripulisce togliendolo.
  async function start(id: string, indexes: number[]) {
    const e = entry(id)
    const draft = await read(e)
    const known = new Set(draft.files.map((f) => f.index))
    const chosen = new Set(indexes)
    if (draft.status !== 'ready' || !chosen.size || [...chosen].some((i) => !known.has(i))) {
      throw new InvalidSelectionError()
    }
    const needed = draft.files.filter((f) => chosen.has(f.index)).reduce((s, f) => s + f.size, 0)
    const free = await qbt.freeSpace()
    if (needed > free) throw new InsufficientSpaceError(needed, free)

    const hash = draft.infoHash
    const excluded = draft.files.filter((f) => !chosen.has(f.index)).map((f) => f.index)
    const added = e.torrent !== null
    try {
      if (e.torrent) {
        await qbt.add({ torrent: e.torrent, stopped: true, tags: DRAFT_TAG })
        await waitAdded(hash)
      }
      if (excluded.length) await qbt.filePrio(hash, excluded, 0)
      await qbt.removeTags(hash, DRAFT_TAG)
      await qbt.start(hash)
    } catch (err) {
      // Con un .torrent non deve restare nulla di parziale; un magnet resta
      // bozza e si può riprovare.
      if (added) await qbt.delete(hash, true).catch(() => {})
      else await qbt.addTags(hash, DRAFT_TAG).catch(() => {})
      throw new StartFailedError((err as Error).message)
    }
    store.delete(id)
    return { hash }
  }

  // Annulla (DL-008): una bozza da magnet esce da qBittorrent con i file
  // eventualmente scaricati; le altre stavano solo in memoria.
  async function discard(id: string) {
    const e = store.get(id)
    if (!e) return
    store.delete(id)
    if (e.draft.source !== 'magnet') return
    const [t] = await qbt.torrents({ hashes: [e.draft.infoHash] })
    if (t && isDraft(t)) await qbt.delete(t.hash, true)
  }

  // Bozze rimaste in qBittorrent (pagina chiusa, backend riavviato): via
  // quelle più vecchie di 30 minuti. Gira all'avvio e ogni ora.
  async function sweepOrphans() {
    const limit = now() - DRAFT_TTL_MS
    const list = await qbt.torrents({ tag: DRAFT_TAG })
    const old = list.filter((t) => isDraft(t) && t.added_on * 1000 < limit)
    for (const t of old) await qbt.delete(t.hash, true)
    return old.length
  }

  return {
    fromTorrent,
    fromMagnet,
    start,
    discard,
    sweepOrphans,
    get: async (id: string) => read(entry(id)),
    // Riprova: altri 60 secondi di attesa dei metadati.
    async retry(id: string) {
      const e = entry(id)
      e.waitFrom = now()
      return read(e)
    },
    store,
  }
}

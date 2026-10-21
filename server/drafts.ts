// Bozze del wizard Aggiungi: un torrent letto ma non ancora dato a
// qBittorrent. Le bozze da file stanno solo in memoria e scadono da sole.
import { randomUUID } from 'node:crypto'

import type { TorrentFile, TorrentMeta } from './torrentfile.ts'

export type DraftSource = 'file' | 'url'

// Come in api/openapi.yaml (schema Draft).
export type Draft = {
  id: string
  source: DraftSource
  status: 'ready'
  infoHash: string
  name: string
  size: number
  files: TorrentFile[]
}

type Entry = { draft: Draft; torrent: Buffer; createdAt: number }

export type DraftStore = ReturnType<typeof createDraftStore>

export const DRAFT_TTL_MS = 30 * 60_000

export function createDraftStore({ now = Date.now, ttlMs = DRAFT_TTL_MS } = {}) {
  const entries = new Map<string, Entry>()

  function sweep() {
    const limit = now() - ttlMs
    for (const [id, e] of entries) if (e.createdAt < limit) entries.delete(id)
  }

  return {
    add(source: DraftSource, meta: TorrentMeta, torrent: Buffer): Draft {
      sweep()
      const draft: Draft = { id: randomUUID(), source, status: 'ready', ...meta }
      entries.set(draft.id, { draft, torrent, createdAt: now() })
      return draft
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

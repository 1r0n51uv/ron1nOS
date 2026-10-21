// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { DEBIAN_DVD } from '../e2e/torrents.ts'
import { createDraftStore } from './drafts.ts'
import { parseTorrent } from './torrentfile.ts'

describe('createDraftStore', () => {
  it('le bozze scadono dopo 30 minuti', () => {
    let t = 0
    const store = createDraftStore({ now: () => t })
    const draft = store.add('file', parseTorrent(DEBIAN_DVD), DEBIAN_DVD)
    t = 29 * 60_000
    expect(store.get(draft.id)?.torrent).toBe(DEBIAN_DVD)
    t = 31 * 60_000
    expect(store.get(draft.id)).toBeUndefined()
  })

  it('delete toglie la bozza', () => {
    const store = createDraftStore()
    const draft = store.add('file', parseTorrent(DEBIAN_DVD), DEBIAN_DVD)
    expect(store.delete(draft.id)).toBe(true)
    expect(store.get(draft.id)).toBeUndefined()
  })
})

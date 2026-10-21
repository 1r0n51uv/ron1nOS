// QbtClient finto per i test unitari del backend: tutte le chiamate sono
// vi.fn, con un elenco di torrent filtrabile per hash.
import { vi } from 'vitest'

import type { QbtClient, QbtTorrent } from '../qbittorrent.ts'

export function qbtTorrent(over: Partial<QbtTorrent> = {}): QbtTorrent {
  return {
    hash: 'a',
    name: 'debian.iso',
    progress: 0.5,
    state: 'downloading',
    eta: 120,
    dlspeed: 2048,
    size: 10,
    tags: '',
    num_seeds: 0,
    num_leechs: 0,
    ...over,
  }
}

export function fakeQbt(over: Partial<QbtClient> = {}, list: QbtTorrent[] = [qbtTorrent()]): QbtClient {
  return {
    transferInfo: vi.fn(async () => ({ dl_info_speed: 2048 })),
    torrents: vi.fn(async (filter?: { hashes?: string[] }) =>
      filter?.hashes ? list.filter((t) => filter.hashes!.includes(t.hash)) : list,
    ),
    files: vi.fn(async () => []),
    add: vi.fn(async () => {}),
    delete: vi.fn(async () => {}),
    filePrio: vi.fn(async () => {}),
    start: vi.fn(async () => {}),
    addTags: vi.fn(async () => {}),
    removeTags: vi.fn(async () => {}),
    freeSpace: vi.fn(async () => 500_000_000_000),
    defaultSavePath: vi.fn(async () => '/downloads'),
    ...over,
  }
}

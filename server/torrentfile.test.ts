// @vitest-environment node
import { createHash } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { DEBIAN_DVD, makeTorrent } from '../e2e/torrents.ts'
import type { Encodable } from './bencode.ts'
import { encode } from './bencode.ts'
import { InvalidTorrentError, parseTorrent } from './torrentfile.ts'

describe('parseTorrent', () => {
  it('legge un torrent v1 a più file', () => {
    const meta = parseTorrent(DEBIAN_DVD)
    expect(meta.name).toBe('debian-13.1.0-amd64-DVD')
    expect(meta.size).toBe(7_900_002_000)
    expect(meta.files).toEqual([
      { index: 0, path: 'debian-13.1.0-amd64-DVD/debian-13.1.0-amd64-DVD-1.iso', size: 3_900_000_000 },
      { index: 1, path: 'debian-13.1.0-amd64-DVD/debian-13.1.0-amd64-DVD-2.iso', size: 4_000_000_000 },
      { index: 2, path: 'debian-13.1.0-amd64-DVD/SHA256SUMS', size: 1_000 },
      { index: 3, path: 'debian-13.1.0-amd64-DVD/SHA256SUMS.sign', size: 1_000 },
    ])
  })

  it('calcola l’infohash v1 sul dizionario info grezzo', () => {
    const info = { length: 5, name: 'a.iso', 'piece length': 16384, pieces: Buffer.alloc(20) }
    const hash = createHash('sha1').update(encode(info)).digest('hex')
    expect(parseTorrent(encode({ info })).infoHash).toBe(hash)
  })

  it('legge un torrent a file singolo', () => {
    const meta = parseTorrent(makeTorrent('ubuntu.iso', undefined, 42))
    expect(meta.files).toEqual([{ index: 0, path: 'ubuntu.iso', size: 42 }])
  })

  it('salta i file di riempimento dei torrent ibridi', () => {
    const info: Encodable = {
      name: 'dir',
      'piece length': 16384,
      pieces: Buffer.alloc(20),
      files: [
        { path: ['a'], length: 1 },
        { path: ['.pad', '16383'], length: 16383, attr: 'p' },
        { path: ['b'], length: 2 },
      ],
    }
    expect(parseTorrent(encode({ info })).files.map((f) => f.path)).toEqual(['dir/a', 'dir/b'])
  })

  it('legge un torrent solo v2', () => {
    const info = {
      name: 'dir',
      'meta version': 2,
      'piece length': 16384,
      'file tree': { 'b.txt': { '': { length: 2 } }, sub: { 'a.txt': { '': { length: 1 } } } },
    }
    const meta = parseTorrent(encode({ info }))
    expect(meta.files.map((f) => f.path)).toEqual(['dir/b.txt', 'dir/sub/a.txt'])
    expect(meta.infoHash).toBe(createHash('sha256').update(encode(info)).digest('hex').slice(0, 40))
  })

  it('legge un torrent v2 a file singolo', () => {
    const info = {
      name: 'a.iso',
      'meta version': 2,
      'piece length': 16384,
      'file tree': { 'a.iso': { '': { length: 9 } } },
    }
    expect(parseTorrent(encode({ info })).files).toEqual([{ index: 0, path: 'a.iso', size: 9 }])
  })

  it.each([
    ['non bencode', Buffer.from('ciao')],
    ['senza info', encode({ announce: 'x' })],
    ['senza pezzi', encode({ info: { name: 'a', length: 1 } })],
    ['percorso che esce', encode({ info: { name: 'a', pieces: 'x', files: [{ path: ['..'], length: 1 }] } })],
    ['nome con barra', encode({ info: { name: 'a/b', pieces: 'x', length: 1 } })],
    ['dimensione negativa', encode({ info: { name: 'a', pieces: 'x', length: -1 } })],
    ['oltre 10 MB', Buffer.alloc(10 * 1024 * 1024 + 1)],
  ])('rifiuta un torrent %s', (_, buf) => {
    expect(() => parseTorrent(buf)).toThrow(InvalidTorrentError)
  })
})

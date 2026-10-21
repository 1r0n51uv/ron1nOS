// Lettura di un file .torrent: infohash, nome e file, senza toccare
// qBittorrent. Supporta torrent v1, v2 e ibridi.
import { createHash } from 'node:crypto'

import type { BValue } from './bencode.ts'
import { BencodeError, decode } from './bencode.ts'

export const MAX_TORRENT_BYTES = 10 * 1024 * 1024

export type TorrentFile = { index: number; path: string; size: number }

export type TorrentMeta = {
  infoHash: string // v1 (sha1) o, per i soli v2, sha256 troncato come fa qBittorrent
  name: string
  size: number
  files: TorrentFile[]
}

export class InvalidTorrentError extends Error {
  constructor() {
    super('File torrent non valido')
    this.name = 'InvalidTorrentError'
  }
}

type Dict = { [key: string]: BValue }

function isDict(v: BValue | undefined): v is Dict {
  return typeof v === 'object' && v !== null && !Buffer.isBuffer(v) && !Array.isArray(v)
}

function text(v: BValue | undefined) {
  if (!Buffer.isBuffer(v)) throw new InvalidTorrentError()
  return v.toString('utf8')
}

function size(v: BValue | undefined) {
  if (typeof v !== 'number' || v < 0) throw new InvalidTorrentError()
  return v
}

// Un segmento di percorso non deve poter uscire dalla cartella del torrent.
function segment(v: BValue | undefined) {
  const s = text(v)
  if (!s || s === '.' || s === '..' || s.includes('/') || s.includes('\\')) throw new InvalidTorrentError()
  return s
}

function v1Files(info: Dict, name: string): Omit<TorrentFile, 'index'>[] {
  if (info.files === undefined) return [{ path: name, size: size(info.length) }]
  if (!Array.isArray(info.files) || !info.files.length) throw new InvalidTorrentError()
  return info.files
    .map((f) => {
      if (!isDict(f) || !Array.isArray(f.path) || !f.path.length) throw new InvalidTorrentError()
      return { path: [name, ...f.path.map(segment)].join('/'), size: size(f.length), pad: isPad(f) }
    })
    .filter((f) => !f.pad)
    .map(({ path, size }) => ({ path, size }))
}

// I file di riempimento dei torrent ibridi non vanno mostrati.
function isPad(f: Dict) {
  return Buffer.isBuffer(f.attr) && f.attr.toString().includes('p')
}

function v2Files(tree: Dict, prefix: string[]): Omit<TorrentFile, 'index'>[] {
  return Object.keys(tree)
    .sort()
    .flatMap((key) => {
      const node = tree[key]
      if (!isDict(node)) throw new InvalidTorrentError()
      if (key === '') {
        return [{ path: prefix.join('/'), size: size(node.length) }]
      }
      return v2Files(node, [...prefix, segment(Buffer.from(key))])
    })
}

// Nei v2 a file singolo l'albero contiene solo `name`; altrimenti i file
// stanno sotto la cartella `name`.
function v2List(tree: Dict, name: string) {
  const only = Object.keys(tree)
  const leaf = isDict(tree[name]) ? (tree[name] as Dict)[''] : undefined
  if (only.length === 1 && only[0] === name && isDict(leaf)) return [{ path: name, size: size(leaf.length) }]
  return v2Files(tree, [name])
}

export function parseTorrent(buf: Buffer): TorrentMeta {
  if (buf.length > MAX_TORRENT_BYTES) throw new InvalidTorrentError()
  let decoded
  try {
    decoded = decode(buf)
  } catch (err) {
    if (err instanceof BencodeError) throw new InvalidTorrentError()
    throw err
  }
  const { value, info: span } = decoded
  if (!isDict(value) || !isDict(value.info) || !span) throw new InvalidTorrentError()
  const info = value.info
  const name = segment(info.name)
  const raw = buf.subarray(span.start, span.end)

  const hasV1 = Buffer.isBuffer(info.pieces)
  const hasV2 = info['meta version'] === 2 && isDict(info['file tree'])
  if (!hasV1 && !hasV2) throw new InvalidTorrentError()

  const list = hasV1 ? v1Files(info, name) : v2List(info['file tree'] as Dict, name)
  if (!list.length) throw new InvalidTorrentError()
  const infoHash = hasV1
    ? createHash('sha1').update(raw).digest('hex')
    : createHash('sha256').update(raw).digest('hex').slice(0, 40)

  const files = list.map((f, index) => ({ index, ...f }))
  return { infoHash, name, size: files.reduce((s, f) => s + f.size, 0), files }
}

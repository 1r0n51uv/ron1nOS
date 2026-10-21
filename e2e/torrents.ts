// Torrent finti per i test: piccoli, validi, con pezzi casuali.
import type { Encodable } from '../server/bencode.ts'
import { encode } from '../server/bencode.ts'

type FileSpec = { path: string[]; length: number }

export function makeTorrent(name: string, files?: FileSpec[], length = 1_048_576): Buffer {
  const info: Record<string, Encodable> = {
    name,
    'piece length': 262_144,
    pieces: Buffer.alloc(20, 7),
  }
  if (files) info.files = files.map((f) => ({ path: f.path, length: f.length }))
  else info.length = length
  return encode({ announce: 'udp://tracker.example:1337', info })
}

// Il torrent del mockup: una cartella con quattro file.
export const DEBIAN_DVD = makeTorrent('debian-13.1.0-amd64-DVD', [
  { path: ['debian-13.1.0-amd64-DVD-1.iso'], length: 3_900_000_000 },
  { path: ['debian-13.1.0-amd64-DVD-2.iso'], length: 4_000_000_000 },
  { path: ['SHA256SUMS'], length: 1_000 },
  { path: ['SHA256SUMS.sign'], length: 1_000 },
])

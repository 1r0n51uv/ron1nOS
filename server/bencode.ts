// Decoder bencode minimo per leggere i file .torrent sul server.
// Le stringhe restano Buffer: nei torrent i pezzi sono binari.

export type BValue = number | Buffer | BValue[] | { [key: string]: BValue }

export class BencodeError extends Error {
  constructor(message = 'bencode non valido') {
    super(message)
    this.name = 'BencodeError'
  }
}

const MAX_DEPTH = 64

type Span = { start: number; end: number }

// Decodifica tutto il buffer. `info` è il tratto grezzo del valore della
// chiave `info` del dizionario radice, che serve per l'infohash.
export function decode(buf: Buffer): { value: BValue; info?: Span } {
  let pos = 0
  let info: Span | undefined

  function byte() {
    if (pos >= buf.length) throw new BencodeError()
    return buf[pos]
  }

  function int(end: number) {
    const text = buf.toString('latin1', pos, end)
    if (!/^(0|-?[1-9]\d*)$/.test(text)) throw new BencodeError()
    const n = Number(text)
    if (!Number.isSafeInteger(n)) throw new BencodeError()
    pos = end + 1
    return n
  }

  function str(): Buffer {
    const colon = buf.indexOf(0x3a, pos)
    if (colon < 0) throw new BencodeError()
    const text = buf.toString('latin1', pos, colon)
    if (!/^(0|[1-9]\d*)$/.test(text)) throw new BencodeError()
    const len = Number(text)
    const start = colon + 1
    if (start + len > buf.length) throw new BencodeError()
    pos = start + len
    return buf.subarray(start, pos)
  }

  function value(depth: number): BValue {
    if (depth > MAX_DEPTH) throw new BencodeError()
    const c = byte()
    if (c === 0x69 /* i */) {
      pos++
      const end = buf.indexOf(0x65, pos)
      if (end < 0) throw new BencodeError()
      return int(end)
    }
    if (c === 0x6c /* l */) {
      pos++
      const list: BValue[] = []
      while (byte() !== 0x65) list.push(value(depth + 1))
      pos++
      return list
    }
    if (c === 0x64 /* d */) {
      pos++
      const dict: { [key: string]: BValue } = Object.create(null)
      while (byte() !== 0x65) {
        const key = str().toString('utf8')
        const start = pos
        dict[key] = value(depth + 1)
        if (depth === 0 && key === 'info') info = { start, end: pos }
      }
      pos++
      return dict
    }
    if (c >= 0x30 && c <= 0x39) return str()
    throw new BencodeError()
  }

  const result = value(0)
  if (pos !== buf.length) throw new BencodeError()
  return { value: result, info }
}

export type Encodable = number | string | Buffer | Encodable[] | { [key: string]: Encodable }

// Encoder per i test e per i torrent finti dell'e2e.
export function encode(v: Encodable): Buffer {
  if (typeof v === 'string') v = Buffer.from(v)
  if (typeof v === 'number') return Buffer.from(`i${v}e`)
  if (Buffer.isBuffer(v)) return Buffer.concat([Buffer.from(`${v.length}:`), v])
  if (Array.isArray(v)) return Buffer.concat([Buffer.from('l'), ...v.map(encode), Buffer.from('e')])
  const keys = Object.keys(v).sort()
  return Buffer.concat([
    Buffer.from('d'),
    ...keys.flatMap((k) => [encode(k), encode(v[k])]),
    Buffer.from('e'),
  ])
}

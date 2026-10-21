// Download dell'URL di un .torrent fatto dal server, con le difese SSRF
// della specifica: solo http(s), niente indirizzi interni (controllati al
// momento della connessione, anche dopo ogni redirect), 3 redirect,
// 15 secondi, 10 MB.
import { lookup as dnsLookup } from 'node:dns'
import http from 'node:http'
import https from 'node:https'
import type { LookupFunction } from 'node:net'
import { BlockList, isIP } from 'node:net'

import { MAX_TORRENT_BYTES } from './torrentfile.ts'

export class TorrentFetchError extends Error {
  constructor(reason: string) {
    super(`Impossibile scaricare il file torrent: ${reason}`)
    this.name = 'TorrentFetchError'
  }
}

const blocked = new BlockList()
blocked.addSubnet('0.0.0.0', 8, 'ipv4')
blocked.addSubnet('127.0.0.0', 8, 'ipv4')
blocked.addSubnet('10.0.0.0', 8, 'ipv4')
blocked.addSubnet('172.16.0.0', 12, 'ipv4')
blocked.addSubnet('192.168.0.0', 16, 'ipv4')
blocked.addSubnet('169.254.0.0', 16, 'ipv4')
blocked.addSubnet('100.64.0.0', 10, 'ipv4')
blocked.addSubnet('224.0.0.0', 4, 'ipv4')
blocked.addSubnet('240.0.0.0', 4, 'ipv4')
blocked.addAddress('::', 'ipv6')
blocked.addAddress('::1', 'ipv6')
blocked.addSubnet('fc00::', 7, 'ipv6')
blocked.addSubnet('fe80::', 10, 'ipv6')
blocked.addSubnet('ff00::', 8, 'ipv6')

export function isBlockedAddress(address: string) {
  const family = isIP(address)
  if (family === 4) return blocked.check(address, 'ipv4')
  if (family === 6) {
    // IPv4 scritto come IPv6 (::ffff:10.0.0.1): vale la regola IPv4.
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address)
    if (mapped) return blocked.check(mapped[1], 'ipv4')
    return blocked.check(address, 'ipv6')
  }
  return true
}

// Risolve il nome e rifiuta gli indirizzi interni: il controllo avviene
// sull'indirizzo a cui ci si connette davvero, quindi niente DNS rebinding.
const safeLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, '', 4)
    const list = addresses as { address: string; family: number }[]
    const bad = list.find((a) => isBlockedAddress(a.address))
    if (bad || !list.length) {
      return callback(new TorrentFetchError('indirizzo non permesso'), '', 4)
    }
    if (options.all) return (callback as unknown as (e: null, a: typeof list) => void)(null, list)
    callback(null, list[0].address, list[0].family)
  })
}

type Options = {
  timeoutMs?: number
  maxRedirects?: number
  // Solo per i test: permette gli indirizzi locali.
  allowPrivate?: boolean
}

export async function fetchTorrent(url: string, opts: Options = {}): Promise<Buffer> {
  const { timeoutMs = 15_000, maxRedirects = 3, allowPrivate = false } = opts
  const deadline = AbortSignal.timeout(timeoutMs)
  let current = url
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const res = await get(current, deadline, allowPrivate)
    if (res.kind === 'body') return res.body
    current = res.location
  }
  throw new TorrentFetchError('troppi redirect')
}

type Result = { kind: 'body'; body: Buffer } | { kind: 'redirect'; location: string }

function get(raw: string, signal: AbortSignal, allowPrivate: boolean): Promise<Result> {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return Promise.reject(new TorrentFetchError('URL non valido'))
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return Promise.reject(new TorrentFetchError('protocollo non permesso'))
  }
  if (url.username || url.password) return Promise.reject(new TorrentFetchError('credenziali nell’URL'))
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (!allowPrivate && isIP(host) && isBlockedAddress(host)) {
    return Promise.reject(new TorrentFetchError('indirizzo non permesso'))
  }

  const client = url.protocol === 'https:' ? https : http
  return new Promise((resolve, reject) => {
    const req = client.get(
      url,
      {
        signal,
        lookup: allowPrivate ? undefined : safeLookup,
        headers: { accept: 'application/x-bittorrent, */*;q=0.5', 'user-agent': 'ron1nOS' },
      },
      (res) => {
        const status = res.statusCode ?? 0
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume()
          resolve({ kind: 'redirect', location: new URL(res.headers.location, url).toString() })
          return
        }
        if (status !== 200) {
          res.resume()
          reject(new TorrentFetchError(`risposta ${status}`))
          return
        }
        const declared = Number(res.headers['content-length'])
        if (declared > MAX_TORRENT_BYTES) {
          res.destroy()
          reject(new TorrentFetchError('file troppo grande'))
          return
        }
        const chunks: Buffer[] = []
        let total = 0
        res.on('data', (chunk: Buffer) => {
          total += chunk.length
          if (total > MAX_TORRENT_BYTES) {
            res.destroy()
            reject(new TorrentFetchError('file troppo grande'))
            return
          }
          chunks.push(chunk)
        })
        res.on('end', () => resolve({ kind: 'body', body: Buffer.concat(chunks) }))
        res.on('error', (err) => reject(wrap(err)))
      },
    )
    req.on('error', (err) => reject(wrap(err)))
  })
}

function wrap(err: Error) {
  if (err instanceof TorrentFetchError) return err
  if (err.name === 'AbortError' || err.name === 'TimeoutError') return new TorrentFetchError('tempo scaduto')
  return new TorrentFetchError(err.message)
}

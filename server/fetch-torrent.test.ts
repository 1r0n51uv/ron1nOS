// @vitest-environment node
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { fetchTorrent, isBlockedAddress, TorrentFetchError } from './fetch-torrent.ts'

let server: Server
let base: string

beforeAll(async () => {
  server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://x')
    const hops = Number(url.searchParams.get('hops') ?? 0)
    if (url.pathname === '/redirect') {
      res.writeHead(302, { location: hops > 1 ? `/redirect?hops=${hops - 1}` : '/ok' }).end()
    } else if (url.pathname === '/ok') {
      res.end('d4:infod4:name1:aee')
    } else if (url.pathname === '/big') {
      res.write(Buffer.alloc(6 * 1024 * 1024))
      res.end(Buffer.alloc(6 * 1024 * 1024))
    } else if (url.pathname === '/slow') {
      setTimeout(() => res.end('tardi'), 500)
    } else {
      res.writeHead(404).end()
    }
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(() => {
  server.close()
})

const local = { allowPrivate: true }

describe('fetchTorrent', () => {
  it('scarica il file', async () => {
    expect((await fetchTorrent(`${base}/ok`, local)).toString()).toBe('d4:infod4:name1:aee')
  })

  it('segue fino a tre redirect', async () => {
    expect((await fetchTorrent(`${base}/redirect?hops=3`, local)).length).toBeGreaterThan(0)
    await expect(fetchTorrent(`${base}/redirect?hops=4`, local)).rejects.toThrow('troppi redirect')
  })

  it('si ferma oltre 10 MB', async () => {
    await expect(fetchTorrent(`${base}/big`, local)).rejects.toThrow('file troppo grande')
  })

  it('si ferma allo scadere del tempo', async () => {
    await expect(fetchTorrent(`${base}/slow`, { ...local, timeoutMs: 100 })).rejects.toThrow('tempo scaduto')
  })

  it('rifiuta risposte diverse da 200', async () => {
    await expect(fetchTorrent(`${base}/manca`, local)).rejects.toThrow('risposta 404')
  })

  it.each(['ftp://example.com/a.torrent', 'file:///etc/passwd', 'non un url'])('rifiuta %s', async (url) => {
    await expect(fetchTorrent(url)).rejects.toBeInstanceOf(TorrentFetchError)
  })

  it('rifiuta gli indirizzi interni, anche per nome', async () => {
    await expect(fetchTorrent(`${base}/ok`)).rejects.toThrow('indirizzo non permesso')
    const port = (server.address() as AddressInfo).port
    await expect(fetchTorrent(`http://localhost:${port}/ok`)).rejects.toThrow('indirizzo non permesso')
  })

  it('rifiuta le credenziali nell’URL', async () => {
    await expect(fetchTorrent('http://user:pw@example.com/a.torrent')).rejects.toThrow('credenziali')
  })
})

describe('isBlockedAddress', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.20.0.5',
    '192.168.1.10',
    '169.254.169.254',
    '100.100.100.100',
    '0.0.0.0',
    '::1',
    'fd7a:115c:a1e0::1',
    'fe80::1',
    '::ffff:10.0.0.1',
  ])('blocca %s', (a) => expect(isBlockedAddress(a)).toBe(true))

  it.each(['1.1.1.1', '151.101.1.69', '2606:4700::1111'])('permette %s', (a) =>
    expect(isBlockedAddress(a)).toBe(false),
  )
})

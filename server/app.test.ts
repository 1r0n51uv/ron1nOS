// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

import { DEBIAN_DVD } from '../e2e/torrents.ts'
import { createApp } from './app.ts'
import { TorrentFetchError } from './fetch-torrent.ts'
import type { QbtClient } from './qbittorrent.ts'
import { QbtAuthError, QbtUnreachableError } from './qbittorrent.ts'

function fakeQbt(over: Partial<QbtClient> = {}): QbtClient {
  return {
    transferInfo: vi.fn(async () => ({ dl_info_speed: 2048 })),
    torrents: vi.fn(async () => [
      {
        hash: 'a',
        name: 'debian.iso',
        progress: 0.5,
        state: 'downloading',
        eta: 120,
        dlspeed: 2048,
        size: 10,
      },
    ]),
    ...over,
  }
}

describe('API /api/v1', () => {
  it('health risponde ok', async () => {
    const res = await createApp({ qbt: fakeQbt() }).request('/api/v1/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('GET /downloads restituisce velocità e torrent', async () => {
    const res = await createApp({ qbt: fakeQbt() }).request('/api/v1/downloads')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      downloadSpeed: 2048,
      torrents: [
        {
          hash: 'a',
          name: 'debian.iso',
          progress: 0.5,
          state: 'downloading',
          etaSeconds: 120,
          downloadSpeed: 2048,
          size: 10,
        },
      ],
    })
  })

  it('qBittorrent spento → 503 qbittorrent_unreachable', async () => {
    const qbt = fakeQbt({ torrents: vi.fn().mockRejectedValue(new QbtUnreachableError('giù')) })
    const res = await createApp({ qbt }).request('/api/v1/downloads')
    expect(res.status).toBe(503)
    expect(await res.json()).toMatchObject({ error: 'qbittorrent_unreachable' })
  })

  it('credenziali errate → 502 qbittorrent_auth', async () => {
    const qbt = fakeQbt({ transferInfo: vi.fn().mockRejectedValue(new QbtAuthError('no')) })
    const res = await createApp({ qbt }).request('/api/v1/downloads')
    expect(res.status).toBe(502)
    expect(await res.json()).toMatchObject({ error: 'qbittorrent_auth' })
  })

  it('le risposte non contengono le credenziali', async () => {
    const res = await createApp({ qbt: fakeQbt() }).request('/api/v1/downloads')
    expect(await res.text()).not.toMatch(/password|admin/i)
  })

  it('una rotta API sconosciuta risponde 404 JSON', async () => {
    const res = await createApp({ qbt: fakeQbt() }).request('/api/v1/nulla')
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ error: 'not_found' })
  })

  it('un errore inatteso risponde 500 senza dettagli', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const qbt = fakeQbt({ torrents: vi.fn().mockRejectedValue(new Error('segreto interno')) })
    const res = await createApp({ qbt }).request('/api/v1/downloads')
    expect(res.status).toBe(500)
    expect(await res.text()).not.toContain('segreto interno')
    error.mockRestore()
  })
})

describe('API /api/v1/downloads/drafts', () => {
  function upload(app: ReturnType<typeof createApp>, bytes: Buffer, name = 'a.torrent') {
    const form = new FormData()
    form.set('file', new File([new Uint8Array(bytes)], name, { type: 'application/x-bittorrent' }))
    return app.request('/api/v1/downloads/drafts', { method: 'POST', body: form })
  }

  function link(app: ReturnType<typeof createApp>, value: unknown) {
    return app.request('/api/v1/downloads/drafts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ link: value }),
    })
  }

  it('crea una bozza da un file e la rilegge', async () => {
    const app = createApp({ qbt: fakeQbt() })
    const res = await upload(app, DEBIAN_DVD)
    expect(res.status).toBe(201)
    const draft = (await res.json()) as { id: string; files: unknown[]; infoHash: string }
    expect(draft).toMatchObject({
      source: 'file',
      status: 'ready',
      name: 'debian-13.1.0-amd64-DVD',
      size: 7_900_002_000,
    })
    expect(draft.files).toHaveLength(4)
    expect(draft.infoHash).toMatch(/^[0-9a-f]{40}$/)

    const again = await app.request(`/api/v1/downloads/drafts/${draft.id}`)
    expect(await again.json()).toEqual(draft)
  })

  it('un file non torrent risponde 400 invalid_torrent', async () => {
    const res = await upload(createApp({ qbt: fakeQbt() }), Buffer.from('ciao'))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'invalid_torrent' })
  })

  it('un file oltre 10 MB risponde 400 invalid_torrent', async () => {
    const res = await upload(createApp({ qbt: fakeQbt() }), Buffer.alloc(11 * 1024 * 1024))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'invalid_torrent' })
  })

  it('crea una bozza da un URL scaricato dal server', async () => {
    const fetchTorrent = vi.fn(async () => DEBIAN_DVD)
    const res = await link(createApp({ qbt: fakeQbt(), fetchTorrent }), ' https://example.com/d.torrent ')
    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({ source: 'url', name: 'debian-13.1.0-amd64-DVD' })
    expect(fetchTorrent).toHaveBeenCalledWith('https://example.com/d.torrent')
  })

  it.each([
    ['download fallito', async () => Promise.reject(new TorrentFetchError('tempo scaduto'))],
    ['contenuto non torrent', async () => Buffer.from('<html>')],
  ])('URL con %s risponde 422', async (_, fetchTorrent) => {
    const res = await link(createApp({ qbt: fakeQbt(), fetchTorrent }), 'https://example.com/d.torrent')
    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({ error: 'torrent_fetch_failed' })
  })

  it.each(['ftp://example.com/a.torrent', 'ciao', 42, undefined])('link %j non valido: 400', async (v) => {
    const res = await link(createApp({ qbt: fakeQbt() }), v)
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'invalid_link' })
  })

  it('bozza sconosciuta: 404', async () => {
    const res = await createApp({ qbt: fakeQbt() }).request('/api/v1/downloads/drafts/nessuna')
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ error: 'draft_not_found' })
  })
})

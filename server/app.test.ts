// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

import { createApp } from './app.ts'
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

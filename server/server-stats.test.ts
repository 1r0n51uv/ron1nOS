// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

import { createApp } from './app.ts'
import { GlancesUnreachableError, type GlancesClient } from './glances.ts'
import type { QbtClient } from './qbittorrent.ts'

const qbt = {} as QbtClient

describe('GET /api/v1/server/stats', () => {
  it('restituisce le statistiche di Glances', async () => {
    const glances: GlancesClient = {
      stats: vi.fn(async () => ({ cpu: 10, ram: 20, disk: 30, uptimeSec: 60 })),
    }
    const res = await createApp({ qbt, glances }).request('/api/v1/server/stats')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ cpu: 10, ram: 20, disk: 30, uptimeSec: 60 })
  })

  it('con Glances irraggiungibile risponde 503', async () => {
    const glances: GlancesClient = {
      stats: vi.fn(async () => {
        throw new GlancesUnreachableError('giù')
      }),
    }
    const res = await createApp({ qbt, glances }).request('/api/v1/server/stats')
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'glances_unreachable', message: 'Glances non raggiungibile' })
  })

  it('senza Glances configurato risponde 503', async () => {
    const res = await createApp({ qbt }).request('/api/v1/server/stats')
    expect(res.status).toBe(503)
  })

  it('è in sola lettura', async () => {
    const glances: GlancesClient = { stats: vi.fn() }
    const res = await createApp({ qbt, glances }).request('/api/v1/server/stats', { method: 'POST' })
    expect(res.status).toBe(404)
    expect(glances.stats).not.toHaveBeenCalled()
  })
})

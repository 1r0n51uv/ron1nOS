// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

import { createApp } from './app.ts'
import type { Database } from './db.ts'
import { createIntegrations } from './integrations.ts'
import { QbtAuthError, QbtUnreachableError } from './qbittorrent.ts'
import { fakeQbt } from './testing/fake-qbt.ts'

const offline: Database = { status: () => 'disabled' }
const glances = (ok = true) => ({
  stats: vi.fn(async () => {
    if (!ok) throw new Error('ECONNREFUSED http://host.docker.internal:61208')
    return {} as never
  }),
})

describe('integrazioni (SET-009)', () => {
  it('una riga per servizio, con stato, messaggio e ora del controllo', async () => {
    const now = new Date('2026-10-23T06:00:00Z')
    const list = await createIntegrations({
      database: offline,
      qbt: fakeQbt(),
      glances: glances(),
      now: () => now,
    }).list()
    expect(list.map((i) => [i.id, i.state])).toEqual([
      ['postgres', 'not_configured'],
      ['yazio', 'not_configured'],
      ['qbittorrent', 'connected'],
      ['glances', 'connected'],
      ['homeassistant', 'not_configured'],
    ])
    expect(list[0]).toMatchObject({ name: 'Postgres', env: ['DATABASE_URL'], checkedAt: now.toISOString() })
    expect(list[1].env).toContain('YAZIO_TOKEN_KEY')
    expect(list[2].env).toEqual([])
  })

  it('gli errori hanno un messaggio scritto qui, mai quello grezzo con indirizzi', async () => {
    const list = await createIntegrations({
      database: { status: () => 'unavailable' },
      qbt: fakeQbt({ transferInfo: vi.fn(async () => Promise.reject(new QbtAuthError('403'))) }),
      glances: glances(false),
    }).list()
    const byId = Object.fromEntries(list.map((i) => [i.id, i]))
    expect(byId.postgres).toMatchObject({ state: 'error', message: 'Non raggiungibile' })
    expect(byId.qbittorrent.message).toBe('Accesso rifiutato · controlla QBT_USERNAME e QBT_PASSWORD')
    expect(byId.glances).toMatchObject({ state: 'error', message: 'Non raggiungibile' })
    expect(JSON.stringify(list)).not.toMatch(/docker|ECONNREFUSED|http/)
  })

  it('un controllo recente vale 30 secondi, `Verifica` lo rifà subito', async () => {
    let t = Date.parse('2026-10-23T06:00:00Z')
    const transferInfo = vi.fn(async () => ({ dl_info_speed: 0 }))
    const integrations = createIntegrations({
      database: offline,
      qbt: fakeQbt({ transferInfo }),
      now: () => new Date(t),
    })
    await integrations.list()
    t += 10_000
    await integrations.list()
    expect(transferInfo).toHaveBeenCalledTimes(1)
    transferInfo.mockRejectedValueOnce(new QbtUnreachableError('giù'))
    expect(await integrations.verify('qbittorrent')).toMatchObject({
      state: 'error',
      message: 'Non raggiungibile',
    })
    expect(transferInfo).toHaveBeenCalledTimes(2)
  })

  it('GET /integrations e POST /integrations/:id/check', async () => {
    const app = createApp({ qbt: fakeQbt(), database: offline })
    const res = await app.request('/api/v1/integrations')
    expect(res.status).toBe(200)
    expect(((await res.json()) as { integrations: unknown[] }).integrations).toHaveLength(5)
    const one = await app.request('/api/v1/integrations/glances/check', { method: 'POST' })
    expect(await one.json()).toMatchObject({ id: 'glances', state: 'not_configured', env: ['GLANCES_URL'] })
    expect((await app.request('/api/v1/integrations/ftp/check', { method: 'POST' })).status).toBe(404)
  })
})

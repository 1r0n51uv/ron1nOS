// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

import { createGlancesClient, GlancesUnreachableError, parseUptime, toServerStats } from './glances.ts'
import type { GlancesRaw } from './glances.ts'

const raw: GlancesRaw = {
  cpu: { total: 23.4 },
  mem: { percent: 57.2 },
  fs: [
    { mnt_point: '/etc/hostname', percent: 12 },
    { mnt_point: '/rootfs', percent: 64.3 },
  ],
  uptime: '41 days, 1:02:03',
  sensors: [
    { label: 'Composite', value: 41, type: 'temperature_core' },
    { label: 'Tctl', value: 52.5, type: 'temperature_core' },
  ],
  network: [
    { bytes_recv_rate_per_sec: 12_000_000, bytes_sent_rate_per_sec: 800_000 },
    { bytes_recv_rate_per_sec: 400_000, bytes_sent_rate_per_sec: 20_000 },
  ],
  containers: [
    { name: 'qbittorrent', status: 'running', cpu_percent: 14.2, memory_usage: 412_000_000 },
    { name: 'gitea', status: 'exited', cpu_percent: 0, memory_usage: 0 },
    { name: 'caddy', status: 'running', cpu_percent: null, memory_usage: null },
  ],
}

describe('parseUptime', () => {
  it('legge giorni, ore, minuti e secondi', () => {
    expect(parseUptime('41 days, 1:02:03')).toBe(41 * 86_400 + 3_723)
    expect(parseUptime('1 day, 0:00:10')).toBe(86_410)
    expect(parseUptime('0:03:10')).toBe(190)
  })

  it('con un formato sconosciuto restituisce 0', () => {
    expect(parseUptime('sconosciuto')).toBe(0)
  })
})

describe('toServerStats', () => {
  it('riduce le risposte di Glances ai campi del widget', () => {
    expect(toServerStats(raw)).toEqual({
      cpu: 23.4,
      ram: 57.2,
      disk: 64.3,
      tempC: 52.5,
      uptimeSec: 41 * 86_400 + 3_723,
      net: { rxBps: 12_400_000, txBps: 820_000 },
      containers: [
        { name: 'qbittorrent', cpu: 14.2, memBytes: 412_000_000 },
        { name: 'caddy', cpu: 0, memBytes: 0 },
      ],
    })
  })

  it('senza sensori, rete e container omette i campi', () => {
    const stats = toServerStats({ ...raw, sensors: [], network: undefined, containers: undefined })
    expect(stats).not.toHaveProperty('tempC')
    expect(stats).not.toHaveProperty('net')
    expect(stats).not.toHaveProperty('containers')
  })

  it('senza /rootfs usa il mount /', () => {
    expect(toServerStats({ ...raw, fs: [{ mnt_point: '/', percent: 30 }] }).disk).toBe(30)
  })
})

function fakeFetch(over: Record<string, () => Response | Promise<Response>> = {}) {
  const plugins: Record<string, unknown> = { ...raw }
  return vi.fn(async (input: string | URL | Request) => {
    const name = String(input).split('/api/4/')[1]
    if (over[name]) return over[name]()
    return Response.json(plugins[name])
  }) as unknown as typeof fetch
}

describe('createGlancesClient', () => {
  it('chiama i plugin di Glances e restituisce le statistiche', async () => {
    const fetch = fakeFetch()
    const stats = await createGlancesClient({ url: 'http://glances', fetch }).stats()
    expect(stats.cpu).toBe(23.4)
    expect(vi.mocked(fetch).mock.calls.map(([u]) => String(u))).toContain('http://glances/api/4/cpu')
  })

  it('i plugin facoltativi che falliscono vengono omessi', async () => {
    const fetch = fakeFetch({ containers: () => new Response('', { status: 500 }) })
    const stats = await createGlancesClient({ url: 'http://glances', fetch }).stats()
    expect(stats).not.toHaveProperty('containers')
    expect(stats.net).toBeDefined()
  })

  it('Glances spento diventa GlancesUnreachableError', async () => {
    const down = vi.fn(async () => {
      throw new TypeError('fetch failed')
    }) as unknown as typeof globalThis.fetch
    await expect(createGlancesClient({ url: 'http://glances', fetch: down }).stats()).rejects.toBeInstanceOf(
      GlancesUnreachableError,
    )
  })

  it('tiene in cache la lettura per 2 secondi, gli errori no', async () => {
    let t = 0
    const fetch = fakeFetch()
    const client = createGlancesClient({ url: 'http://glances', fetch, now: () => t })
    await client.stats()
    const calls = vi.mocked(fetch).mock.calls.length
    t = 1_500
    await client.stats()
    expect(vi.mocked(fetch).mock.calls.length).toBe(calls)
    t = 2_500
    await client.stats()
    expect(vi.mocked(fetch).mock.calls.length).toBe(calls * 2)
  })
})

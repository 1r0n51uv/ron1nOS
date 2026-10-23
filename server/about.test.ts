// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { buildFromEnv, createAbout } from './about.ts'
import { createApp } from './app.ts'
import { fakeQbt } from './testing/fake-qbt.ts'

describe('informazioni sul backend (SET-012)', () => {
  it('commit e data della build dalle variabili dell’immagine, null fuori', () => {
    expect(buildFromEnv({ RON1NOS_COMMIT: 'abc1234', RON1NOS_BUILT_AT: '2026-10-23T08:00:00Z' })).toEqual({
      commit: 'abc1234',
      builtAt: '2026-10-23T08:00:00Z',
    })
    expect(buildFromEnv({ RON1NOS_COMMIT: ' ' })).toEqual({ commit: null, builtAt: null })
  })

  it('da quanto tempo è acceso', () => {
    const about = createAbout({
      commit: 'abc1234',
      builtAt: null,
      startedAt: new Date('2026-10-23T08:00:00Z'),
      now: () => new Date('2026-10-24T09:30:15Z'),
    })
    expect(about()).toEqual({
      version: { commit: 'abc1234', builtAt: null },
      startedAt: '2026-10-23T08:00:00.000Z',
      uptimeSeconds: 91815,
    })
  })

  it('GET /api/v1/about risponde con versione e avvio', async () => {
    const res = await createApp({
      qbt: fakeQbt(),
      about: { commit: 'def5678', builtAt: '2026-10-23T08:00:00Z' },
    }).request('/api/v1/about')
    expect(res.status).toBe(200)
    const body = JSON.parse(await res.text())
    expect(body.version).toEqual({ commit: 'def5678', builtAt: '2026-10-23T08:00:00Z' })
    expect(body.uptimeSeconds).toBeGreaterThanOrEqual(0)
  })

  it('con il login acceso /about chiede la sessione, health no', async () => {
    const app = createApp({ qbt: fakeQbt(), auth: { passwordHash: 'scrypt$x$y' } })
    expect((await app.request('/api/v1/about')).status).toBe(401)
    expect((await app.request('/api/v1/health')).status).toBe(200)
  })
})

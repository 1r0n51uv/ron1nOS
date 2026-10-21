import { afterEach, describe, expect, it, vi } from 'vitest'

import { api, ApiError } from './api'

afterEach(() => vi.unstubAllGlobals())

function stubFetch(impl: typeof fetch) {
  const fn = vi.fn(impl)
  vi.stubGlobal('fetch', fn)
  return fn
}

describe('api', () => {
  it('prefissa /api/v1 e restituisce il JSON', async () => {
    const fetch = stubFetch(async () => Response.json({ ok: true }))
    await expect(api.get('/health')).resolves.toEqual({ ok: true })
    expect(fetch).toHaveBeenCalledWith('/api/v1/health', undefined)
  })

  it('trasforma gli errori del backend in ApiError', async () => {
    stubFetch(async () =>
      Response.json(
        { error: 'qbittorrent_unreachable', message: 'qBittorrent non raggiungibile' },
        { status: 503 },
      ),
    )
    const err = await api.get('/downloads').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ code: 'qbittorrent_unreachable', status: 503 })
  })

  it('tiene i campi in più del corpo dell’errore', async () => {
    stubFetch(async () =>
      Response.json({ error: 'duplicate', message: 'm', torrent: { name: 'x' } }, { status: 409 }),
    )
    const err = (await api.get('/x').catch((e: unknown) => e)) as ApiError
    expect(err.body.torrent).toEqual({ name: 'x' })
  })

  it('segnala il backend irraggiungibile', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch')
    })
    await expect(api.get('/downloads')).rejects.toMatchObject({ code: 'network' })
  })

  it('invia JSON o FormData', async () => {
    const fetch = stubFetch(async () => Response.json({}))
    await api.post('/x', { a: 1 })
    expect(fetch.mock.calls[0][1]).toMatchObject({ method: 'POST', body: '{"a":1}' })
    const form = new FormData()
    await api.post('/y', form)
    expect(fetch.mock.calls[1][1]?.body).toBe(form)
  })
})

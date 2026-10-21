// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

import { createQbtClient, QbtAuthError, QbtUnreachableError } from './qbittorrent.ts'

const url = 'http://qbittorrent:8080'

function loginOk(sid = 'abc') {
  return new Response('Ok.', { headers: { 'Set-Cookie': `SID=${sid}; HttpOnly; path=/` } })
}

function client(fetch: typeof globalThis.fetch) {
  return createQbtClient({ url, username: 'admin', password: 'admin', fetch })
}

describe('createQbtClient', () => {
  it('fa login e usa il cookie SID con il Referer giusto', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(loginOk())
      .mockResolvedValueOnce(Response.json({ dl_info_speed: 42 }))
    await expect(client(fetch).transferInfo()).resolves.toEqual({ dl_info_speed: 42 })

    const [loginUrl, loginInit] = fetch.mock.calls[0]
    expect(loginUrl).toBe(`${url}/api/v2/auth/login`)
    expect(String(loginInit?.body)).toBe('username=admin&password=admin')
    const [, init] = fetch.mock.calls[1]
    expect(init?.headers).toMatchObject({ Cookie: 'SID=abc', Referer: url })
  })

  it('riusa la sessione tra una chiamata e l’altra', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(loginOk())
      .mockResolvedValueOnce(Response.json([]))
      .mockResolvedValueOnce(Response.json([]))
    const qbt = client(fetch)
    await qbt.torrents()
    await qbt.torrents()
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('rifà il login quando la sessione scade', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(loginOk('vecchio'))
      .mockResolvedValueOnce(new Response('Forbidden', { status: 403 }))
      .mockResolvedValueOnce(loginOk('nuovo'))
      .mockResolvedValueOnce(Response.json([]))
    await expect(client(fetch).torrents()).resolves.toEqual([])
    expect(fetch.mock.calls[3][1]?.headers).toMatchObject({ Cookie: 'SID=nuovo' })
  })

  it('segnala credenziali rifiutate', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response('Fails.'))
    await expect(client(fetch).torrents()).rejects.toBeInstanceOf(QbtAuthError)
  })

  it('segnala un IP bloccato come errore di accesso', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response('', { status: 403 }))
    await expect(client(fetch).torrents()).rejects.toBeInstanceOf(QbtAuthError)
  })

  it('segnala qBittorrent irraggiungibile', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockRejectedValue(new TypeError('fetch failed'))
    await expect(client(fetch).torrents()).rejects.toBeInstanceOf(QbtUnreachableError)
  })

  it('fa un solo login per chiamate in parallelo', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async (input) =>
      String(input).endsWith('/auth/login') ? loginOk() : Response.json([]),
    )
    const qbt = client(fetch)
    await Promise.all([qbt.torrents(), qbt.torrents(), qbt.transferInfo()])
    expect(fetch.mock.calls.filter(([u]) => String(u).endsWith('/auth/login'))).toHaveLength(1)
  })
})

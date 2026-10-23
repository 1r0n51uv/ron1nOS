// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

import { createQbtClient, QbtAuthError, QbtRejectedError, QbtUnreachableError } from './qbittorrent.ts'

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

  it('accetta il login di qBittorrent 5 (204 senza corpo)', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 204,
          headers: { 'Set-Cookie': 'QBT_SID_8080=cinque; HttpOnly; path=/' },
        }),
      )
      .mockResolvedValueOnce(Response.json([]))
    await expect(client(fetch).torrents()).resolves.toEqual([])
    expect(fetch.mock.calls[1][1]?.headers).toMatchObject({ Cookie: 'QBT_SID_8080=cinque' })
  })

  it('segnala un login senza cookie SID come credenziali rifiutate', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(null, { status: 204 }))
    await expect(client(fetch).torrents()).rejects.toBeInstanceOf(QbtAuthError)
  })

  it('segnala credenziali rifiutate da qBittorrent 5 (401)', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(new Response('Unauthorized', { status: 401 }))
    await expect(client(fetch).torrents()).rejects.toBeInstanceOf(QbtAuthError)
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

describe('createQbtClient · scrittura', () => {
  function logged(...responses: Response[]) {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(loginOk())
    for (const r of responses) fetch.mockResolvedValueOnce(r)
    return { fetch, qbt: client(fetch) }
  }

  it('filtra i torrent per hash e tag', async () => {
    const { fetch, qbt } = logged(Response.json([]))
    await qbt.torrents({ hashes: ['a', 'b'], tag: 'ron1nos-draft' })
    expect(fetch.mock.calls[1][0]).toBe(`${url}/api/v2/torrents/info?hashes=a%7Cb&tag=ron1nos-draft`)
  })

  it('aggiunge un magnet in multipart con le opzioni', async () => {
    const { fetch, qbt } = logged(new Response('Ok.'))
    await qbt.add({ magnet: 'magnet:?xt=urn:btih:x', stopCondition: 'MetadataReceived', tags: 't' })
    const [path, init] = fetch.mock.calls[1]
    expect(path).toBe(`${url}/api/v2/torrents/add`)
    const form = init?.body as FormData
    expect(form.get('urls')).toBe('magnet:?xt=urn:btih:x')
    expect(form.get('stopCondition')).toBe('MetadataReceived')
    expect(form.get('tags')).toBe('t')
  })

  it('aggiunge un file .torrent fermo', async () => {
    const { fetch, qbt } = logged(new Response('Ok.'))
    await qbt.add({ torrent: Buffer.from('d4:infoe'), stopped: true })
    const form = fetch.mock.calls[1][1]?.body as FormData
    expect(form.get('torrents')).toBeInstanceOf(Blob)
    expect(form.get('stopped')).toBe('true')
  })

  it('Fails. diventa un rifiuto', async () => {
    const { qbt } = logged(new Response('Fails.'))
    await expect(qbt.add({ magnet: 'm' })).rejects.toBeInstanceOf(QbtRejectedError)
  })

  it('files: null se qBittorrent non conosce il torrent', async () => {
    const { qbt } = logged(new Response('Not Found', { status: 404 }))
    await expect(qbt.files('x')).resolves.toBeNull()
  })

  it('filePrio, start e delete mandano i parametri della Web API', async () => {
    const { fetch, qbt } = logged(new Response(''), new Response(''), new Response(''))
    await qbt.filePrio('h', [1, 3], 0)
    await qbt.start('h')
    await qbt.delete('h', true)
    expect(String(fetch.mock.calls[1][1]?.body)).toBe('hash=h&id=1%7C3&priority=0')
    expect(String(fetch.mock.calls[2][1]?.body)).toBe('hashes=h')
    expect(String(fetch.mock.calls[3][1]?.body)).toBe('hashes=h&deleteFiles=true')
  })

  it('legge lo spazio libero da sync/maindata', async () => {
    const { qbt } = logged(Response.json({ server_state: { free_space_on_disk: 123 } }))
    await expect(qbt.freeSpace()).resolves.toBe(123)
  })
})

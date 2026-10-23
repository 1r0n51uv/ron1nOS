// Client minimo della Web API di qBittorrent (v2). Fa login con utente e
// password, tiene il cookie SID e lo rinnova da solo quando qBittorrent
// risponde 403 (sessione scaduta o qBittorrent riavviato).

export class QbtUnreachableError extends Error {}
export class QbtAuthError extends Error {}
// qBittorrent ha risposto ma non ha fatto quello che si chiedeva.
export class QbtRejectedError extends Error {}

export type QbtTorrent = {
  hash: string
  name: string
  progress: number // 0..1
  state: string
  eta: number // secondi, 8640000 = infinito
  dlspeed: number // B/s
  size: number // byte selezionati
  tags: string // separati da virgola
  num_seeds: number
  num_leechs: number
  added_on: number // secondi Unix
}

export type QbtTransferInfo = { dl_info_speed: number }

export type QbtFile = { index: number; name: string; size: number }

export type QbtAdd = {
  magnet?: string
  torrent?: Buffer
  stopped?: boolean
  stopCondition?: 'MetadataReceived' | 'FilesChecked'
  tags?: string
}

export type QbtClient = {
  torrents(filter?: { hashes?: string[]; tag?: string }): Promise<QbtTorrent[]>
  transferInfo(): Promise<QbtTransferInfo>
  // null se qBittorrent non conosce il torrent; [] finché mancano i metadati.
  files(hash: string): Promise<QbtFile[] | null>
  add(opts: QbtAdd): Promise<void>
  delete(hash: string, deleteFiles: boolean): Promise<void>
  filePrio(hash: string, indexes: number[], priority: number): Promise<void>
  start(hash: string): Promise<void>
  addTags(hash: string, tags: string): Promise<void>
  removeTags(hash: string, tags: string): Promise<void>
  freeSpace(): Promise<number>
  defaultSavePath(): Promise<string>
}

type Options = {
  url: string
  username: string
  password: string
  fetch?: typeof fetch
  timeoutMs?: number
}

export function createQbtClient({
  url,
  username,
  password,
  fetch = globalThis.fetch,
  timeoutMs = 5000,
}: Options) {
  // qBittorrent rifiuta le richieste il cui Referer non corrisponde all'Host.
  const headers = { Referer: url }
  let sid: string | null = null
  let loggingIn: Promise<void> | null = null

  async function call(path: string, init: RequestInit = {}) {
    try {
      return await fetch(url + path, { ...init, signal: AbortSignal.timeout(timeoutMs) })
    } catch (err) {
      throw new QbtUnreachableError(`qBittorrent non raggiungibile: ${(err as Error).message}`)
    }
  }

  async function login() {
    const res = await call('/api/v2/auth/login', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ username, password }),
    })
    const body = await res.text()
    if (res.status === 403) throw new QbtAuthError('IP bloccato da qBittorrent dopo troppi login falliti')
    if (!res.ok) throw new QbtUnreachableError(`login: HTTP ${res.status}`)
    // Fino alla 4.x il login riuscito risponde 200 "Ok.", dalla 5 risponde 204
    // senza corpo: conta il cookie SID. Credenziali errate: 200 "Fails.".
    const cookie = res.headers.getSetCookie().find((c) => c.startsWith('SID='))
    if (!cookie || body.trim() === 'Fails.') throw new QbtAuthError('credenziali di qBittorrent rifiutate')
    sid = cookie.slice(4).split(';')[0]
  }

  async function ensureLogin() {
    if (sid !== null) return
    loggingIn ??= login().finally(() => (loggingIn = null))
    await loggingIn
  }

  // Richiesta autenticata; con 403 rifà il login una volta.
  async function request(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
    await ensureLogin()
    const res = await call(path, {
      ...init,
      headers: { ...headers, ...(sid ? { Cookie: `SID=${sid}` } : {}), ...init.headers },
    })
    if (res.status === 403) {
      sid = null
      if (retry) return request(path, init, false)
      throw new QbtAuthError('sessione di qBittorrent rifiutata')
    }
    return res
  }

  async function get<T>(path: string): Promise<T> {
    const res = await request(path)
    if (!res.ok) throw new QbtUnreachableError(`${path}: HTTP ${res.status}`)
    return (await res.json()) as T
  }

  async function post(path: string, body: Record<string, string> | FormData) {
    const res = await request(path, {
      method: 'POST',
      body: body instanceof FormData ? body : new URLSearchParams(body),
    })
    const text = await res.text()
    if (!res.ok) throw new QbtRejectedError(`${path}: HTTP ${res.status} ${text}`.trim())
    if (text.trim() === 'Fails.') throw new QbtRejectedError(`${path}: Fails.`)
  }

  return {
    torrents(filter = {}) {
      const q = new URLSearchParams()
      if (filter.hashes) q.set('hashes', filter.hashes.join('|'))
      if (filter.tag) q.set('tag', filter.tag)
      const qs = q.size ? `?${q}` : ''
      return get<QbtTorrent[]>(`/api/v2/torrents/info${qs}`)
    },
    transferInfo: () => get<QbtTransferInfo>('/api/v2/transfer/info'),
    async files(hash) {
      const res = await request(`/api/v2/torrents/files?hash=${encodeURIComponent(hash)}`)
      if (res.status === 404) return null
      if (!res.ok) throw new QbtUnreachableError(`torrents/files: HTTP ${res.status}`)
      return (await res.json()) as QbtFile[]
    },
    async add({ magnet, torrent, stopped, stopCondition, tags }) {
      const form = new FormData()
      if (magnet) form.set('urls', magnet)
      if (torrent) {
        form.set(
          'torrents',
          new Blob([new Uint8Array(torrent)], { type: 'application/x-bittorrent' }),
          'draft.torrent',
        )
      }
      if (stopped !== undefined) form.set('stopped', String(stopped))
      if (stopCondition) form.set('stopCondition', stopCondition)
      if (tags) form.set('tags', tags)
      await post('/api/v2/torrents/add', form)
    },
    delete: (hash, deleteFiles) =>
      post('/api/v2/torrents/delete', { hashes: hash, deleteFiles: String(deleteFiles) }),
    filePrio: (hash, indexes, priority) =>
      post('/api/v2/torrents/filePrio', { hash, id: indexes.join('|'), priority: String(priority) }),
    start: (hash) => post('/api/v2/torrents/start', { hashes: hash }),
    addTags: (hash, tags) => post('/api/v2/torrents/addTags', { hashes: hash, tags }),
    removeTags: (hash, tags) => post('/api/v2/torrents/removeTags', { hashes: hash, tags }),
    async freeSpace() {
      const data = await get<{ server_state?: { free_space_on_disk?: number } }>('/api/v2/sync/maindata')
      return data.server_state?.free_space_on_disk ?? 0
    },
    async defaultSavePath() {
      const res = await request('/api/v2/app/defaultSavePath')
      if (!res.ok) throw new QbtUnreachableError(`app/defaultSavePath: HTTP ${res.status}`)
      return (await res.text()).trim()
    },
  } satisfies QbtClient
}

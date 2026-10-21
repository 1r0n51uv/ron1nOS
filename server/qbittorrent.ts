// Client minimo della Web API di qBittorrent (v2). Fa login con utente e
// password, tiene il cookie SID e lo rinnova da solo quando qBittorrent
// risponde 403 (sessione scaduta o qBittorrent riavviato).

export class QbtUnreachableError extends Error {}
export class QbtAuthError extends Error {}

export type QbtTorrent = {
  hash: string
  name: string
  progress: number // 0..1
  state: string
  eta: number // secondi, 8640000 = infinito
  dlspeed: number // B/s
  size: number // byte selezionati
}

export type QbtTransferInfo = { dl_info_speed: number }

export type QbtClient = {
  torrents(): Promise<QbtTorrent[]>
  transferInfo(): Promise<QbtTransferInfo>
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
    if (body.trim() !== 'Ok.') throw new QbtAuthError('credenziali di qBittorrent rifiutate')
    const cookie = res.headers.getSetCookie().find((c) => c.startsWith('SID='))
    sid = cookie ? cookie.slice(4).split(';')[0] : ''
  }

  async function ensureLogin() {
    if (sid !== null) return
    loggingIn ??= login().finally(() => (loggingIn = null))
    await loggingIn
  }

  async function get<T>(path: string, retry = true): Promise<T> {
    await ensureLogin()
    const res = await call(path, { headers: { ...headers, ...(sid ? { Cookie: `SID=${sid}` } : {}) } })
    if (res.status === 403) {
      sid = null
      if (retry) return get<T>(path, false)
      throw new QbtAuthError('sessione di qBittorrent rifiutata')
    }
    if (!res.ok) throw new QbtUnreachableError(`${path}: HTTP ${res.status}`)
    return (await res.json()) as T
  }

  return {
    torrents: () => get<QbtTorrent[]>('/api/v2/torrents/info'),
    transferInfo: () => get<QbtTransferInfo>('/api/v2/transfer/info'),
  } satisfies QbtClient
}

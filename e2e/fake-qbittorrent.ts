// qBittorrent finto per gli e2e: implementa solo le rotte della Web API che
// il backend usa, con login admin/admin e cookie SID. Le rotte /__fake/*
// cambiano lo stato dai test (qBittorrent spento, credenziali cambiate).
import type { IncomingMessage } from 'node:http'
import { createServer } from 'node:http'

const port = Number(process.env.FAKE_QBT_PORT ?? 18080)
const SID = 'e2e-sid'

type State = { online: boolean; password: string }
const initial: State = { online: true, password: 'admin' }
let state: State = { ...initial }

const torrents = [
  {
    hash: 'a1',
    name: 'ubuntu-24.04.3-desktop-amd64.iso',
    progress: 0.72,
    state: 'downloading',
    eta: 180,
    dlspeed: 8_000_000,
    size: 6_000_000_000,
  },
  {
    hash: 'b2',
    name: 'debian-13.1.0-amd64-netinst.iso',
    progress: 0.31,
    state: 'downloading',
    eta: 420,
    dlspeed: 4_000_000,
    size: 800_000_000,
  },
  {
    hash: 'c3',
    name: 'proxmox-ve_9.0-1.iso',
    progress: 0,
    state: 'queuedDL',
    eta: 8640000,
    dlspeed: 0,
    size: 1,
  },
  {
    hash: 'd4',
    name: 'archlinux-2026.10.01-x86_64.iso',
    progress: 1,
    state: 'uploading',
    eta: 0,
    dlspeed: 0,
    size: 1,
  },
]

function readBody(req: IncomingMessage) {
  return new Promise<string>((resolve) => {
    let data = ''
    req.on('data', (chunk) => (data += chunk))
    req.on('end', () => resolve(data))
  })
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${port}`)
  const json = (status: number, body: unknown) => {
    res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body))
  }

  if (url.pathname === '/__fake/health') return json(200, { ok: true })
  if (url.pathname === '/__fake/state' && req.method === 'POST') {
    state = { ...state, ...JSON.parse((await readBody(req)) || '{}') }
    return json(200, state)
  }
  if (url.pathname === '/__fake/reset' && req.method === 'POST') {
    state = { ...initial }
    return json(200, state)
  }

  // "Spento": chiude la connessione senza risposta, come un host irraggiungibile.
  if (!state.online) return req.socket.destroy()

  if (url.pathname === '/api/v2/auth/login' && req.method === 'POST') {
    const form = new URLSearchParams(await readBody(req))
    if (form.get('username') === 'admin' && form.get('password') === state.password) {
      res.writeHead(200, { 'Set-Cookie': `SID=${SID}; HttpOnly; path=/` }).end('Ok.')
    } else {
      res.writeHead(200).end('Fails.')
    }
    return
  }
  if (req.headers.cookie !== `SID=${SID}` || state.password !== 'admin') {
    res.writeHead(403).end('Forbidden')
    return
  }
  if (url.pathname === '/api/v2/transfer/info') return json(200, { dl_info_speed: 12_100_000 })
  if (url.pathname === '/api/v2/torrents/info') return json(200, torrents)
  res.writeHead(404).end('Not Found')
}).listen(port)

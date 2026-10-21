// qBittorrent finto per gli e2e: implementa solo le rotte della Web API che
// il backend usa, con login admin/admin e cookie SID. Le rotte /__fake/*
// cambiano lo stato dai test (qBittorrent spento, credenziali cambiate,
// peer che non mandano i metadati) e mostrano i torrent aggiunti.
import type { IncomingMessage } from 'node:http'
import { createServer } from 'node:http'

import { parseMagnet } from '../server/magnet.ts'
import { parseTorrent } from '../server/torrentfile.ts'
import { DEBIAN_DVD } from './torrents.ts'

const port = Number(process.env.FAKE_QBT_PORT ?? 18080)
const SID = 'e2e-sid'

type State = {
  online: boolean
  password: string
  // I magnet ricevono i metadati dopo metadataDelayMs, oppure mai.
  metadata: 'yes' | 'never'
  metadataDelayMs: number
  freeSpace: number
}
const initial: State = {
  online: true,
  password: 'admin',
  metadata: 'yes',
  metadataDelayMs: 1_500,
  freeSpace: 412_000_000_000,
}
let state: State = { ...initial }

type File = { index: number; name: string; size: number; priority: number }
type Added = (typeof torrents)[number] & {
  tags: string
  files: File[] | null
  num_seeds: number
  num_leechs: number
  added_on: number
}

// Torrent aggiunti dal backend durante il test.
let added: Added[] = []

// I file che i "peer" mandano per ogni magnet: quelli del DVD Debian.
const MAGNET_FILES = parseTorrent(DEBIAN_DVD).files

function filesOf(meta: { files: { index: number; path: string; size: number }[] }): File[] {
  return meta.files.map((f) => ({ index: f.index, name: f.path, size: f.size, priority: 1 }))
}

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

function readRaw(req: IncomingMessage) {
  return new Promise<Buffer>((resolve) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
  })
}

async function readBody(req: IncomingMessage) {
  return (await readRaw(req)).toString()
}

function readForm(req: IncomingMessage, raw: Buffer) {
  return new Response(new Uint8Array(raw), {
    headers: { 'content-type': req.headers['content-type'] ?? '' },
  }).formData()
}

function all() {
  return [
    ...torrents.map((t): Added => ({
      ...t,
      tags: '',
      files: null,
      num_seeds: 0,
      num_leechs: 0,
      added_on: 0,
    })),
    ...added,
  ]
}

function find(hash: string | null) {
  return added.find((t) => t.hash === hash)
}

async function add(req: IncomingMessage) {
  const form = await readForm(req, await readRaw(req))
  const tags = String(form.get('tags') ?? '')
  const stopped = form.get('stopped') === 'true'
  const magnetLink = form.get('urls')
  const file = form.get('torrents')
  let t: Added
  if (typeof magnetLink === 'string') {
    const magnet = parseMagnet(magnetLink)
    if (!magnet || find(magnet.infoHash)) return false
    t = {
      hash: magnet.infoHash,
      name: magnet.name ?? magnet.infoHash,
      progress: 0,
      state: 'metaDL',
      eta: 8640000,
      dlspeed: 0,
      size: 0,
      tags,
      files: null,
      num_seeds: 3,
      num_leechs: 0,
      added_on: Math.floor(Date.now() / 1000),
    }
    if (state.metadata === 'yes') {
      setTimeout(() => {
        t.files = filesOf({ files: MAGNET_FILES })
        t.name = 'debian-13.1.0-amd64-DVD'
        t.size = t.files.reduce((s, f) => s + f.size, 0)
        t.state = 'stoppedDL' // stopCondition=MetadataReceived
      }, state.metadataDelayMs)
    }
  } else if (file instanceof Blob) {
    const meta = parseTorrent(Buffer.from(await file.arrayBuffer()))
    if (find(meta.infoHash)) return false
    t = {
      hash: meta.infoHash,
      name: meta.name,
      progress: 0,
      state: stopped ? 'stoppedDL' : 'downloading',
      eta: 8640000,
      dlspeed: 0,
      size: meta.size,
      tags,
      files: filesOf(meta),
      num_seeds: 0,
      num_leechs: 0,
      added_on: Math.floor(Date.now() / 1000),
    }
  } else {
    return false
  }
  added.push(t)
  return true
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
    added = []
    return json(200, state)
  }
  if (url.pathname === '/__fake/torrents' && req.method === 'GET') return json(200, added)
  if (url.pathname === '/__fake/torrents' && req.method === 'POST') {
    const t = JSON.parse(await readBody(req)) as Partial<Added>
    added.push({
      hash: '',
      name: '',
      progress: 1,
      state: 'uploading',
      eta: 0,
      dlspeed: 0,
      size: 1,
      tags: '',
      files: [],
      num_seeds: 0,
      num_leechs: 0,
      added_on: Math.floor(Date.now() / 1000),
      ...t,
    })
    return json(200, added)
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
  const api = url.pathname.replace('/api/v2/', '')
  if (api === 'torrents/info') {
    const hashes = url.searchParams.get('hashes')?.split('|')
    const tag = url.searchParams.get('tag')
    return json(
      200,
      all()
        .filter((t) => !hashes || hashes.includes(t.hash))
        .filter((t) => !tag || t.tags.split(',').includes(tag))
        .map(({ files: _files, ...t }) => t),
    )
  }
  if (api === 'torrents/files') {
    const t = find(url.searchParams.get('hash'))
    if (!t) return res.writeHead(404).end('Not Found')
    return json(200, t.files ?? [])
  }
  if (api === 'app/defaultSavePath') return res.writeHead(200).end('/downloads')
  if (api === 'sync/maindata') return json(200, { server_state: { free_space_on_disk: state.freeSpace } })
  if (api === 'torrents/add' && req.method === 'POST') {
    return res.writeHead(200).end((await add(req)) ? 'Ok.' : 'Fails.')
  }
  if (req.method === 'POST' && api.startsWith('torrents/')) {
    const form = new URLSearchParams(await readBody(req))
    const t = find(form.get('hashes') ?? form.get('hash'))
    if (!t) return res.writeHead(404).end('Not Found')
    if (api === 'torrents/delete') added = added.filter((x) => x !== t)
    else if (api === 'torrents/start') t.state = 'downloading'
    else if (api === 'torrents/addTags') t.tags = [t.tags, form.get('tags')].filter(Boolean).join(',')
    else if (api === 'torrents/removeTags') {
      t.tags = t.tags
        .split(',')
        .filter((x) => x !== form.get('tags'))
        .join(',')
    } else if (api === 'torrents/filePrio') {
      const ids = (form.get('id') ?? '').split('|').map(Number)
      for (const f of t.files ?? []) if (ids.includes(f.index)) f.priority = Number(form.get('priority'))
    } else return res.writeHead(404).end('Not Found')
    return res.writeHead(200).end()
  }
  res.writeHead(404).end('Not Found')
}).listen(port)

// Glances finto per gli e2e: risponde ai plugin dell'API 4 che il backend
// legge, con valori fissi. Le rotte /__fake/* cambiano lo stato dai test
// (Glances spento, temperatura alta).
import type { IncomingMessage } from 'node:http'
import { createServer } from 'node:http'

const port = Number(process.env.FAKE_GLANCES_PORT ?? 18081)

type State = { online: boolean; tempC: number }
const initial: State = { online: true, tempC: 52 }
let state: State = { ...initial }

function plugins(): Record<string, unknown> {
  return {
    cpu: { total: 23.4 },
    mem: { percent: 57.2 },
    fs: [
      { mnt_point: '/rootfs', percent: 64.3 },
      { mnt_point: '/etc/hostname', percent: 12 },
    ],
    uptime: '41 days, 1:02:03',
    sensors: [{ label: 'Tctl', value: state.tempC, type: 'temperature_core' }],
    network: [{ bytes_recv_rate_per_sec: 12_400_000, bytes_sent_rate_per_sec: 820_000 }],
    containers: [
      { name: 'qbittorrent', status: 'running', cpu_percent: 14.2, memory_usage: 412_000_000 },
      { name: '1r0-api', status: 'running', cpu_percent: 6.1, memory_usage: 188_000_000 },
      { name: 'postgres', status: 'running', cpu_percent: 3.4, memory_usage: 1_240_000_000 },
      { name: 'caddy', status: 'running', cpu_percent: 0.4, memory_usage: 42_000_000 },
      { name: 'gitea', status: 'exited', cpu_percent: 0, memory_usage: 0 },
    ],
    // Il backend non deve mai inoltrarlo.
    processlist: [{ name: 'postgres', cmdline: ['postgres', '--password=segreta'] }],
  }
}

function readBody(req: IncomingMessage) {
  return new Promise<string>((resolve) => {
    let data = ''
    req.on('data', (chunk) => (data += chunk))
    req.on('end', () => resolve(data))
  })
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${port}`)
  // Connection: close evita che Playwright riusi un socket keep-alive appena
  // chiuso dal server (ECONNRESET tra due comandi distanti più di 5 s).
  const json = (status: number, body: unknown) => {
    res
      .writeHead(status, { 'Content-Type': 'application/json', Connection: 'close' })
      .end(JSON.stringify(body))
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

  if (!state.online) return req.socket.destroy()

  const name = url.pathname.replace(/^\/api\/4\//, '')
  const all = plugins()
  if (name in all) return json(200, all[name])
  res.writeHead(404).end('Not Found')
}).listen(port)

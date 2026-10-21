// Client dell'API REST di Glances (v4). Legge solo i plugin che servono al
// widget Server e li riduce a un oggetto piccolo e stabile: ai client non
// arrivano processi, righe di comando, IP né immagini dei container.

export class GlancesUnreachableError extends Error {}

export type ServerStats = {
  cpu: number
  ram: number
  disk: number
  tempC?: number
  uptimeSec: number
  net?: { rxBps: number; txBps: number }
  containers?: { name: string; cpu: number; memBytes: number }[]
}

export type GlancesClient = { stats(): Promise<ServerStats> }

type Fs = { mnt_point: string; percent: number }
type Sensor = { label: string; value: number; type?: string }
type Net = { bytes_recv_rate_per_sec?: number; bytes_sent_rate_per_sec?: number }
type Container = {
  name: string
  status?: string
  cpu_percent?: number | null
  memory_usage?: number | null
}

export type GlancesRaw = {
  cpu: { total: number }
  mem: { percent: number }
  fs: Fs[]
  uptime: string
  sensors?: Sensor[]
  network?: Net[]
  containers?: Container[]
}

// Glances restituisce l'uptime come testo: "41 days, 1:02:03" o "0:03:10".
export function parseUptime(text: string) {
  const m = /^(?:(\d+) days?, )?(\d+):(\d{2}):(\d{2})/.exec(text.trim())
  if (!m) return 0
  const [, d = '0', h, min, s] = m
  return Number(d) * 86_400 + Number(h) * 3_600 + Number(min) * 60 + Number(s)
}

// Il disco di sistema dell'host è montato in /rootfs (infra/glances).
function systemDisk(fs: Fs[]) {
  return (fs.find((f) => f.mnt_point === '/rootfs') ?? fs.find((f) => f.mnt_point === '/'))?.percent ?? 0
}

function cpuTemp(sensors: Sensor[]) {
  const s = sensors.find((x) => x.label === 'Tctl') ?? sensors.find((x) => x.type === 'temperature_core')
  return s?.value
}

export function toServerStats(raw: GlancesRaw): ServerStats {
  const stats: ServerStats = {
    cpu: raw.cpu.total,
    ram: raw.mem.percent,
    disk: systemDisk(raw.fs),
    uptimeSec: parseUptime(raw.uptime),
  }
  const tempC = raw.sensors && cpuTemp(raw.sensors)
  if (tempC !== undefined) stats.tempC = tempC
  // Le interfacce virtuali sono già nascoste da glances.conf.
  if (raw.network) {
    stats.net = {
      rxBps: raw.network.reduce((sum, n) => sum + (n.bytes_recv_rate_per_sec ?? 0), 0),
      txBps: raw.network.reduce((sum, n) => sum + (n.bytes_sent_rate_per_sec ?? 0), 0),
    }
  }
  if (raw.containers) {
    stats.containers = raw.containers
      .filter((c) => (c.status ?? 'running') === 'running')
      .map((c) => ({ name: c.name, cpu: c.cpu_percent ?? 0, memBytes: c.memory_usage ?? 0 }))
  }
  return stats
}

type Options = {
  url: string
  fetch?: typeof fetch
  timeoutMs?: number
  cacheMs?: number
  now?: () => number
}

export function createGlancesClient({
  url,
  fetch = globalThis.fetch,
  timeoutMs = 3000,
  cacheMs = 2000,
  now = Date.now,
}: Options): GlancesClient {
  async function plugin<T>(name: string): Promise<T> {
    let res: Response
    try {
      res = await fetch(`${url}/api/4/${name}`, { signal: AbortSignal.timeout(timeoutMs) })
    } catch (err) {
      throw new GlancesUnreachableError(`Glances non raggiungibile: ${(err as Error).message}`)
    }
    if (!res.ok) throw new GlancesUnreachableError(`Glances ha risposto ${res.status} su ${name}`)
    return (await res.json()) as T
  }

  // Facoltativi: senza sensore o senza socket Docker il resto funziona.
  async function optional<T>(name: string) {
    try {
      return await plugin<T>(name)
    } catch {
      return undefined
    }
  }

  async function read() {
    const [cpu, mem, fs, uptime, sensors, network, containers] = await Promise.all([
      plugin<GlancesRaw['cpu']>('cpu'),
      plugin<GlancesRaw['mem']>('mem'),
      plugin<Fs[]>('fs'),
      plugin<string>('uptime'),
      optional<Sensor[]>('sensors'),
      optional<Net[]>('network'),
      optional<Container[]>('containers'),
    ])
    return toServerStats({ cpu, mem, fs, uptime, sensors, network, containers })
  }

  // Cache breve: più schede o client aperti non moltiplicano le chiamate.
  let cached: { at: number; value: Promise<ServerStats> } | null = null
  return {
    stats() {
      if (cached && now() - cached.at < cacheMs) return cached.value
      const value = read()
      cached = { at: now(), value }
      value.catch(() => {
        if (cached?.value === value) cached = null
      })
      return value
    },
  }
}

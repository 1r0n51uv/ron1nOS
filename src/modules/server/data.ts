import { useQuery } from '@tanstack/react-query'

import { uptime } from '@/lib/format'
import { mockDelay } from '@/lib/mock'

// Stessa forma della risposta di GET /api/v1/server/stats (specifica
// docs/specs/server.md). Le percentuali arrivano con i decimali di Glances.
export type ServerStats = {
  cpu: number // %
  ram: number // %
  disk: number // %
  tempC?: number // assente senza sensore della CPU
  uptimeSec: number
  // Somma delle interfacce fisiche, in byte al secondo (SRV-003).
  net?: { rxBps: number; txBps: number }
  // Solo i container in esecuzione; assente senza socket Docker (SRV-004).
  containers?: ContainerUsage[]
}

export type ContainerUsage = {
  name: string
  cpu: number // % di un core, può superare 100
  memBytes: number
}

// Soglia oltre la quale un valore diventa rosso.
export const ALERT_THRESHOLD = 80

const base: ServerStats = {
  cpu: 23.4,
  ram: 57.2,
  disk: 82.1,
  tempC: 52,
  uptimeSec: 41 * 86_400 + 3_600,
  net: { rxBps: 12_400_000, txBps: 820_000 },
  containers: [
    { name: 'qbittorrent', cpu: 14.2, memBytes: 412_000_000 },
    { name: '1r0-api', cpu: 6.1, memBytes: 188_000_000 },
    { name: 'postgres', cpu: 3.4, memBytes: 1_240_000_000 },
    { name: 'caddy', cpu: 0.4, memBytes: 42_000_000 },
    { name: 'uptime-kuma', cpu: 0, memBytes: 96_000_000 },
    { name: 'watchtower', cpu: 0, memBytes: 18_000_000 },
  ],
}

function jitter(v: number, by: number) {
  return Math.max(0, Math.min(100, v + (Math.random() - 0.5) * by))
}

// Mock: da sostituire con GET /api/v1/server/stats (issue #14).
export function getServerStats(): Promise<ServerStats> {
  return mockDelay({
    ...base,
    cpu: jitter(base.cpu, 14),
    ram: jitter(base.ram, 4),
    tempC: jitter(52, 4),
  })
}

export function useServerStats() {
  return useQuery({ queryKey: ['server', 'stats'], queryFn: getServerStats, refetchInterval: 5_000 })
}

// Percentuale intera mostrata negli anelli (SRV-001).
export function percent(value: number) {
  return Math.round(Math.max(0, Math.min(100, value)))
}

// Testata del widget: temperatura arrotondata e uptime, omettendo la
// temperatura se manca il sensore (SRV-002).
export function headerMeta({ tempC, uptimeSec }: Pick<ServerStats, 'tempC' | 'uptimeSec'>) {
  const parts = [tempC === undefined ? null : `${Math.round(tempC)} °C`, uptime(uptimeSec)]
  return parts.filter(Boolean).join(' · ')
}

// I container che consumano di più: CPU più alta, a parità la RAM (SRV-004).
export function topContainers(list: ContainerUsage[], n = 3) {
  return [...list].sort((a, b) => b.cpu - a.cpu || b.memBytes - a.memBytes).slice(0, n)
}

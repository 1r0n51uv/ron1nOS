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

import { useQuery } from '@tanstack/react-query'

import { mockDelay } from '@/lib/mock'

export type ServerStats = {
  cpu: number // %
  ram: number // %
  disk: number // %
  tempC: number
  uptimeDays: number
}

// Soglia oltre la quale un valore diventa rosso.
export const ALERT_THRESHOLD = 80

const base: ServerStats = { cpu: 23, ram: 57, disk: 82, tempC: 52, uptimeDays: 41 }

function jitter(v: number, by: number) {
  return Math.max(0, Math.min(100, Math.round(v + (Math.random() - 0.5) * by)))
}

// Mock: da sostituire con node-exporter o un endpoint dell'API del server.
export function getServerStats() {
  return mockDelay({ ...base, cpu: jitter(base.cpu, 14), ram: jitter(base.ram, 4), tempC: jitter(base.tempC, 4) })
}

export function useServerStats() {
  return useQuery({ queryKey: ['server', 'stats'], queryFn: getServerStats, refetchInterval: 5_000 })
}

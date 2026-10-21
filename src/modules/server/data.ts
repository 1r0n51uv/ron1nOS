import { useQuery } from '@tanstack/react-query'

import { uptime } from '@/lib/format'
import { api } from '@/lib/api'

// Risposta di GET /api/v1/server/stats (specifica docs/specs/server.md,
// contratto in api/openapi.yaml). Le percentuali hanno i decimali di Glances.
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

// Soglie del rosso (SRV-005): anelli in percentuale, temperatura della CPU.
export const THRESHOLDS = { percent: 80, tempC: 85 }

export function isHot(tempC: number | undefined): tempC is number {
  return tempC !== undefined && Math.round(tempC) >= THRESHOLDS.tempC
}

export function getServerStats() {
  return api.get<ServerStats>('/server/stats')
}

// La sorgente passa da un oggetto così i test possono sostituirla.
export const source = { getServerStats }

export function useServerStats() {
  return useQuery({
    queryKey: ['server', 'stats'],
    queryFn: () => source.getServerStats(),
    // Ogni 5 s, solo con la scheda in primo piano (SRV-007). I dati restano
    // a schermo durante l'aggiornamento: niente skeleton né lampeggi.
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
    // Un solo nuovo tentativo dopo 1 s: offline entro due aggiornamenti (SRV-006).
    retry: 1,
    retryDelay: 1_000,
  })
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

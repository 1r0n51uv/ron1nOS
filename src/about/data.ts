import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api'

// Impostazioni › Informazioni (SET-012): stato da GET /api/v1/health,
// versione e avvio da GET /api/v1/about.
export type Health = { ok: boolean; database: 'disabled' | 'starting' | 'ok' | 'unavailable' }

export type About = {
  version: { commit: string | null; builtAt: string | null }
  startedAt: string
  uptimeSeconds: number
}

export const source = {
  getHealth: () => api.get<Health>('/health'),
  getAbout: () => api.get<About>('/about'),
}

export const REPOSITORY_URL = 'https://github.com/1r0n51uv/ron1nOS'
export const SPEC_URL = `${REPOSITORY_URL}/blob/main/docs/specs/settings.md`

export const DATABASE_LABELS: Record<Health['database'], string> = {
  ok: 'collegato',
  starting: 'in avvio',
  unavailable: 'non raggiungibile',
  disabled: 'non configurato',
}

export function useHealth() {
  return useQuery({ queryKey: ['health'], queryFn: source.getHealth, refetchInterval: 30_000 })
}

export function useAbout() {
  return useQuery({ queryKey: ['about'], queryFn: source.getAbout, refetchInterval: 60_000 })
}

// "12 min", "5 h 3 min", "3 g 4 h": abbastanza per sapere da quando è acceso.
export function uptime(seconds: number) {
  const m = Math.floor(seconds / 60)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (d) return `${d} g ${h % 24} h`
  if (h) return `${h} h ${m % 60} min`
  return `${m} min`
}

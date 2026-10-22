import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { mockDelay } from '@/lib/mock'

export type Container = {
  name: string
  state: 'running' | 'exited' | 'restarting'
  note?: string
}

const mock: Container[] = [
  { name: 'caddy', state: 'running' },
  { name: 'postgres', state: 'running' },
  { name: 'glances', state: 'running' },
  { name: 'ron1nos', state: 'running' },
  { name: 'uptime-kuma', state: 'running' },
  { name: 'watchtower', state: 'running' },
  { name: 'gitea', state: 'exited', note: 'arrestato · memoria esaurita' },
  { name: 'qbittorrent', state: 'running' },
  { name: 'jellyfin', state: 'running' },
  { name: 'home-assistant', state: 'running' },
  { name: 'cloudflared', state: 'running' },
  { name: 'webtop', state: 'running' },
  { name: 'node-exporter', state: 'running' },
  { name: 'adguard', state: 'running' },
]

// Mock: da sostituire con la Docker Engine API (via un backend, mai il
// socket esposto al browser).
export function getContainers() {
  return mockDelay(mock)
}

export async function restartContainer(name: string) {
  const c = mock.find((x) => x.name === name)
  if (c) {
    c.state = 'running'
    delete c.note
  }
  return mockDelay(mock, 900)
}

const key = ['containers']

export function useContainers() {
  return useQuery({ queryKey: key, queryFn: getContainers })
}

export function useRestartContainer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: restartContainer,
    onSuccess: (data) => qc.setQueryData(key, data),
  })
}

export function summarize(list: Container[]) {
  const down = list.filter((c) => c.state !== 'running')
  return { total: list.length, running: list.length - down.length, down }
}

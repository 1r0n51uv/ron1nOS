import { useQuery } from '@tanstack/react-query'

import { mockDelay } from '@/lib/mock'

export type Download = {
  name: string
  progress: number // %
  state: 'downloading' | 'queued' | 'seeding'
  etaSeconds?: number
}
export type Downloads = { speedMBs: number; items: Download[] }

const mock: Downloads = {
  speedMBs: 12.1,
  items: [
    { name: 'ubuntu-24.04.3-desktop.iso', progress: 72, state: 'downloading', etaSeconds: 180 },
    { name: 'debian-13.1.0-amd64-netinst.iso', progress: 31, state: 'downloading', etaSeconds: 420 },
    { name: 'proxmox-ve_9.0-1.iso', progress: 0, state: 'queued' },
    { name: 'archlinux-2026.10.01-x86_64.iso', progress: 100, state: 'seeding' },
  ],
}

// Mock: da sostituire con la Web API di qBittorrent. Ogni lettura fa
// avanzare un po' i download, per vedere il widget muoversi.
export function getDownloads() {
  for (const d of mock.items) {
    if (d.state !== 'downloading') continue
    d.progress = Math.min(100, d.progress + 1)
    d.etaSeconds = Math.max(0, (d.etaSeconds ?? 0) - 5)
    if (d.progress === 100) d.state = 'seeding'
  }
  return mockDelay(mock)
}

export function useDownloads() {
  return useQuery({ queryKey: ['downloads'], queryFn: getDownloads, refetchInterval: 5_000 })
}

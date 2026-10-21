import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api'

// Come in api/openapi.yaml (GET /api/v1/downloads): byte, secondi, frazioni.
export type TorrentState = 'downloading' | 'queued' | 'seeding' | 'stopped' | 'error'

export type Torrent = {
  hash: string
  name: string
  progress: number // 0..1
  state: TorrentState
  etaSeconds: number | null
  downloadSpeed: number // B/s
  size: number // byte
}

export type Downloads = {
  downloadSpeed: number // B/s
  torrents: Torrent[] // già ordinati dal backend
}

export function getDownloads() {
  return api.get<Downloads>('/downloads')
}

export function useDownloads() {
  return useQuery({
    queryKey: ['downloads'],
    queryFn: getDownloads,
    refetchInterval: 5_000,
    // Niente retry: se qBittorrent è giù il widget lo dice al prossimo
    // aggiornamento, e riprende da solo quando torna.
    retry: false,
  })
}

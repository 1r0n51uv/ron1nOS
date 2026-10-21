import { useMutation, useQuery } from '@tanstack/react-query'

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

// Bozze del wizard Aggiungi (POST /api/v1/downloads/drafts).
export type DraftFile = { index: number; path: string; size: number }

export type Draft = {
  id: string
  source: 'file' | 'url'
  status: 'ready'
  infoHash: string
  name: string
  size: number // byte
  files: DraftFile[]
}

export type DraftSource = { kind: 'file'; file: File } | { kind: 'link'; link: string }

export function createDraft(source: DraftSource) {
  if (source.kind === 'link') return api.post<Draft>('/downloads/drafts', { link: source.link })
  const form = new FormData()
  form.set('file', source.file)
  return api.post<Draft>('/downloads/drafts', form)
}

export function useCreateDraft() {
  return useMutation({ mutationFn: createDraft })
}

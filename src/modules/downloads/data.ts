import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

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
  source: 'file' | 'url' | 'magnet'
  // ready: file noti · metadata: magnet in attesa dei peer · timeout: attesa finita
  status: 'ready' | 'metadata' | 'timeout'
  infoHash: string
  name: string
  size: number // byte
  files: DraftFile[]
  metadata?: { peers: number; waitedSeconds: number; limitSeconds: number }
}

// Torrent già presente: arriva nel corpo dell'errore 409 duplicate.
export type DuplicateTorrent = { name: string; state: TorrentState }

export type DraftSource = { kind: 'file'; file: File } | { kind: 'link'; link: string }

export function createDraft(source: DraftSource) {
  if (source.kind === 'link') return api.post<Draft>('/downloads/drafts', { link: source.link })
  const form = new FormData()
  form.set('file', source.file)
  return api.post<Draft>('/downloads/drafts', form)
}

// onCreated parte anche se il wizard è già stato chiuso: serve a buttare
// una bozza arrivata dopo Annulla.
export function useCreateDraft(onCreated?: (draft: Draft) => void) {
  return useMutation({ mutationFn: createDraft, onSuccess: onCreated })
}

// Annulla: in qBittorrent non resta nulla (DL-008). Best effort: le bozze
// perse le toglie comunque il backend dopo 30 minuti.
export function discardDraft(id: string) {
  return api.delete<void>(`/downloads/drafts/${id}`).catch(() => {})
}

// Una bozza magnet si rilegge ogni secondo finché aspetta i metadati.
export function useDraft(initial: Draft | undefined) {
  return useQuery({
    queryKey: ['draft', initial?.id],
    queryFn: () => api.get<Draft>(`/downloads/drafts/${initial!.id}`),
    enabled: !!initial,
    initialData: initial,
    refetchInterval: (q) => (q.state.data?.status === 'metadata' ? 1_000 : false),
    retry: false,
  })
}

export function useRetryDraft() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.post<Draft>(`/downloads/drafts/${id}/retry`),
    onSuccess: (draft) => client.setQueryData(['draft', draft.id], draft),
  })
}

export type Space = { free: number; path: string }

export function useSpace(enabled: boolean) {
  return useQuery({
    queryKey: ['downloads', 'space'],
    queryFn: () => api.get<Space>('/downloads/space'),
    enabled,
    retry: false,
  })
}

// Avvio: poi il widget si aggiorna subito, senza aspettare i 5 secondi.
export function useStartDraft() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, files }: { id: string; files: number[] }) =>
      api.post<{ hash: string }>(`/downloads/drafts/${id}/start`, { files }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['downloads'] }),
  })
}

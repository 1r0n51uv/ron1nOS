// Dai dati grezzi di qBittorrent alla risposta di GET /api/v1/downloads.
// Unità neutre (byte, secondi, frazioni): la formattazione la fa il client.
import type { QbtTorrent, QbtTransferInfo } from './qbittorrent.ts'

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
  downloadSpeed: number // B/s, totale
  torrents: Torrent[]
}

// Stati di qBittorrent 5 (e i vecchi paused* della 4).
const states: Record<string, TorrentState> = {
  downloading: 'downloading',
  metaDL: 'downloading',
  forcedMetaDL: 'downloading',
  forcedDL: 'downloading',
  stalledDL: 'downloading',
  queuedDL: 'queued',
  checkingDL: 'queued',
  allocating: 'queued',
  checkingResumeData: 'queued',
  moving: 'queued',
  uploading: 'seeding',
  stalledUP: 'seeding',
  forcedUP: 'seeding',
  queuedUP: 'seeding',
  checkingUP: 'seeding',
  stoppedDL: 'stopped',
  stoppedUP: 'stopped',
  pausedDL: 'stopped',
  pausedUP: 'stopped',
  error: 'error',
  missingFiles: 'error',
}

const ETA_INFINITE = 8640000
const order: TorrentState[] = ['downloading', 'queued', 'seeding', 'stopped', 'error']

export function mapState(state: string): TorrentState {
  return states[state] ?? 'error'
}

export function toDownloads(transfer: QbtTransferInfo, list: QbtTorrent[]): Downloads {
  const torrents = list.map((t): Torrent => ({
    hash: t.hash,
    name: t.name,
    progress: t.progress,
    state: mapState(t.state),
    etaSeconds: t.eta >= 0 && t.eta < ETA_INFINITE ? t.eta : null,
    downloadSpeed: t.dlspeed,
    size: t.size,
  }))
  // Prima per stato, poi i più vicini alla fine.
  torrents.sort((a, b) => order.indexOf(a.state) - order.indexOf(b.state) || b.progress - a.progress)
  return { downloadSpeed: transfer.dl_info_speed, torrents }
}

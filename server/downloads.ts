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

// Tag delle bozze del wizard Aggiungi: torrent in qBittorrent ma non
// ancora avviati dall'utente, quindi non ancora download.
export const DRAFT_TAG = 'ron1nos-draft'

export function isDraft(t: Pick<QbtTorrent, 'tags'>) {
  return (t.tags ?? '')
    .split(',')
    .map((x) => x.trim())
    .includes(DRAFT_TAG)
}

export function toDownloads(transfer: QbtTransferInfo, list: QbtTorrent[]): Downloads {
  const real = list.filter((t) => !isDraft(t))
  const torrents = real.map((t): Torrent => ({
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

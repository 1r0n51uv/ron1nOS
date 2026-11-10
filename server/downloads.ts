// Dai dati grezzi di qBittorrent alla risposta di GET /api/v1/downloads.
// Unità neutre (byte, secondi, frazioni): la formattazione la fa il client.
import type { QbtFile, QbtTorrent, QbtTransferInfo } from './qbittorrent.ts'

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

export type TorrentFile = {
  index: number
  name: string
  size: number
  progress: number // 0..1
  selected: boolean // false se escluso dal download
}

export type TorrentDetail = Torrent & {
  downloaded: number // byte
  uploadSpeed: number // B/s
  ratio: number
  savePath: string
  addedAt: string // ISO 8601, UTC
  files: TorrentFile[]
}

export function toDetail(t: QbtTorrent, files: QbtFile[]): TorrentDetail {
  const [base] = toDownloads({ dl_info_speed: 0 }, [t]).torrents
  return {
    ...base,
    downloaded: t.downloaded ?? 0,
    uploadSpeed: t.upspeed ?? 0,
    ratio: t.ratio ?? 0,
    savePath: t.save_path ?? '',
    addedAt: new Date(t.added_on * 1000).toISOString(),
    files: files.map((f) => ({
      index: f.index,
      name: f.name,
      size: f.size,
      progress: f.progress ?? 0,
      selected: (f.priority ?? 1) > 0,
    })),
  }
}

export type TorrentAction = 'pause' | 'resume' | 'delete'

export const MAX_ACTION_HASHES = 100

// Infohash v1 (40 esadecimali) o v2 (64).
export const isInfohash = (hash: string) => /^([0-9a-f]{40}|[0-9a-f]{64})$/i.test(hash)

export class TorrentNotFoundError extends Error {}
export class InvalidActionError extends Error {}

// Corpo di POST /downloads/actions: azione, infohash (1..100) e, per
// `delete`, se togliere anche i file.
export function parseAction(body: unknown): {
  action: TorrentAction
  hashes: string[]
  deleteFiles: boolean
} {
  const b = (body ?? {}) as { action?: unknown; hashes?: unknown; deleteFiles?: unknown }
  if (b.action !== 'pause' && b.action !== 'resume' && b.action !== 'delete') throw new InvalidActionError()
  if (
    !Array.isArray(b.hashes) ||
    b.hashes.length === 0 ||
    b.hashes.length > MAX_ACTION_HASHES ||
    !b.hashes.every((h) => typeof h === 'string' && isInfohash(h))
  ) {
    throw new InvalidActionError()
  }
  if (b.deleteFiles !== undefined && typeof b.deleteFiles !== 'boolean') throw new InvalidActionError()
  return { action: b.action, hashes: b.hashes as string[], deleteFiles: b.deleteFiles === true }
}

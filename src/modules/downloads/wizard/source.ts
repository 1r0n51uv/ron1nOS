import type { TorrentState } from '../data'

// Passo 1: cosa è una sorgente valida (DL-004). Il server rifà gli stessi
// controlli; qui servono per attivare Avanti e dare l'errore subito.

export const MAX_TORRENT_BYTES = 10 * 1024 * 1024

export type Link = { kind: 'magnet'; version: 'v1' | 'v2' } | { kind: 'url' }

export function parseLink(text: string): Link | null {
  const t = text.trim()
  if (/^magnet:\?/i.test(t)) {
    if (/\bxt=urn:btih:/i.test(t)) return { kind: 'magnet', version: 'v1' }
    if (/\bxt=urn:btmh:/i.test(t)) return { kind: 'magnet', version: 'v2' }
    return null
  }
  try {
    const url = new URL(t)
    if ((url.protocol === 'http:' || url.protocol === 'https:') && url.hostname) return { kind: 'url' }
  } catch {
    // non è un URL
  }
  return null
}

export function isTorrentFile(file: File) {
  return file.name.toLowerCase().endsWith('.torrent') && file.size > 0 && file.size <= MAX_TORRENT_BYTES
}

// Copia in memoria del file scelto. Sul telefono il File dato dal selettore
// (iCloud, Files, provider di Android) può non essere più leggibile quando
// il passo 2 lo invia, e al server arriva un multipart troncato. Null se il
// file non è valido o non si legge.
export async function readTorrentFile(file: File): Promise<File | null> {
  if (!isTorrentFile(file)) return null
  try {
    const bytes = await file.arrayBuffer()
    if (bytes.byteLength !== file.size) return null
    return new File([bytes], file.name, { type: 'application/x-bittorrent' })
  } catch {
    return null
  }
}

export function linkLabel(link: Link) {
  return link.kind === 'magnet' ? `magnet · ${link.version}` : 'URL di un file .torrent'
}

// Le scelte del passo 1 restano quando si torna indietro (DL-008).
export type SourceState = { tab: 'file' | 'link'; file: File | null; fileError: boolean; link: string }

export const EMPTY_SOURCE: SourceState = { tab: 'file', file: null, fileError: false, link: '' }

export function isReady(s: SourceState) {
  return s.tab === 'file' ? !!s.file && !s.fileError : parseLink(s.link) !== null
}

export const STATE_LABEL: Record<TorrentState, string> = {
  downloading: 'in download',
  queued: 'in coda',
  seeding: 'in seed',
  stopped: 'fermo',
  error: 'in errore',
}

// Attesa dei metadati come nel mockup: 0:18 su 1:00.
export function waitClock(seconds: number) {
  const s = Math.max(0, Math.floor(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

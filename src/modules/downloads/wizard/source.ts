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

export function linkLabel(link: Link) {
  return link.kind === 'magnet' ? `magnet · ${link.version}` : 'URL di un file .torrent'
}

// Le scelte del passo 1 restano quando si torna indietro (DL-008).
export type SourceState = { tab: 'file' | 'link'; file: File | null; fileError: boolean; link: string }

export const EMPTY_SOURCE: SourceState = { tab: 'file', file: null, fileError: false, link: '' }

export function isReady(s: SourceState) {
  return s.tab === 'file' ? !!s.file && !s.fileError : parseLink(s.link) !== null
}

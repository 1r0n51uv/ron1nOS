// Testi del widget Download, separati per poterli testare da soli.
import { ApiError } from '@/lib/api'
import type { Downloads } from './data'

// Quanti torrent attivi mostrare per intero; gli altri finiscono nel riepilogo.
export const VISIBLE = 3

export function eta(seconds: number | null) {
  if (seconds == null) return 'tempo non stimabile'
  if (seconds < 60) return 'meno di 1 min rimanenti'
  const min = Math.round(seconds / 60)
  if (min < 60) return `${min} min rimanenti`
  return `${Math.floor(min / 60)} h ${min % 60} min rimanenti`
}

export function summary({ torrents }: Downloads, visible = VISIBLE) {
  const active = torrents.filter((t) => t.state === 'downloading').length
  const queued = torrents.filter((t) => t.state === 'queued').length
  const seeding = torrents.filter((t) => t.state === 'seeding').length
  const hidden = Math.max(0, active - visible)
  return [
    hidden && `+${hidden} ${hidden === 1 ? 'attivo' : 'attivi'}`,
    queued && `${queued} in coda`,
    seeding && `${seeding} in seed`,
  ]
    .filter(Boolean)
    .join(' · ')
}

// Messaggio da mostrare quando il backend non riesce a leggere qBittorrent.
export function problem(error: unknown) {
  if (error instanceof ApiError && error.code === 'qbittorrent_auth')
    return 'Accesso a qBittorrent non riuscito'
  return 'qBittorrent non raggiungibile'
}

// Testi del widget Download, separati per poterli testare da soli.
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

export function summary({ torrents }: Downloads) {
  const active = torrents.filter((t) => t.state === 'downloading').length
  const queued = torrents.filter((t) => t.state === 'queued').length
  const seeding = torrents.filter((t) => t.state === 'seeding').length
  const hidden = Math.max(0, active - VISIBLE)
  return [
    hidden && `+${hidden} ${hidden === 1 ? 'attivo' : 'attivi'}`,
    queued && `${queued} in coda`,
    seeding && `${seeding} in seed`,
  ]
    .filter(Boolean)
    .join(' · ')
}

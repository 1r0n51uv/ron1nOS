// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { mapState, toDownloads } from './downloads.ts'
import type { QbtTorrent } from './qbittorrent.ts'

function torrent(over: Partial<QbtTorrent>): QbtTorrent {
  return { hash: 'h', name: 'n', progress: 0, state: 'downloading', eta: 60, dlspeed: 0, size: 1, ...over }
}

describe('mapState', () => {
  it.each([
    ['downloading', 'downloading'],
    ['metaDL', 'downloading'],
    ['stalledDL', 'downloading'],
    ['queuedDL', 'queued'],
    ['checkingDL', 'queued'],
    ['uploading', 'seeding'],
    ['stalledUP', 'seeding'],
    ['stoppedDL', 'stopped'],
    ['pausedUP', 'stopped'],
    ['missingFiles', 'error'],
    ['statoNuovo', 'error'],
  ])('%s → %s', (state, expected) => {
    expect(mapState(state)).toBe(expected)
  })
})

describe('toDownloads', () => {
  it('ordina per stato e poi per avanzamento', () => {
    const res = toDownloads({ dl_info_speed: 1000 }, [
      torrent({ hash: 'seed', state: 'uploading', progress: 1 }),
      torrent({ hash: 'lento', progress: 0.2 }),
      torrent({ hash: 'coda', state: 'queuedDL' }),
      torrent({ hash: 'veloce', progress: 0.9 }),
    ])
    expect(res.downloadSpeed).toBe(1000)
    expect(res.torrents.map((t) => t.hash)).toEqual(['veloce', 'lento', 'coda', 'seed'])
  })

  it('trasforma l’ETA infinito in null', () => {
    const [t] = toDownloads({ dl_info_speed: 0 }, [torrent({ eta: 8640000 })]).torrents
    expect(t.etaSeconds).toBeNull()
  })

  it('espone solo i campi dell’API', () => {
    const [t] = toDownloads({ dl_info_speed: 0 }, [
      torrent({ hash: 'x', name: 'iso', dlspeed: 5, size: 9 }),
    ]).torrents
    expect(t).toEqual({
      hash: 'x',
      name: 'iso',
      progress: 0,
      state: 'downloading',
      etaSeconds: 60,
      downloadSpeed: 5,
      size: 9,
    })
  })
})

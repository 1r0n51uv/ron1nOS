// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { InvalidActionError, mapState, parseAction, toDetail, toDownloads } from './downloads.ts'
import type { QbtTorrent } from './qbittorrent.ts'
import { qbtTorrent } from './testing/fake-qbt.ts'

function torrent(over: Partial<QbtTorrent>): QbtTorrent {
  return qbtTorrent({ hash: 'h', name: 'n', progress: 0, eta: 60, dlspeed: 0, size: 1, ...over })
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

describe('toDownloads · bozze', () => {
  it('non mostra le bozze del wizard', () => {
    const list = [torrent({ hash: 'vero' }), torrent({ hash: 'bozza', tags: 'altro, ron1nos-draft' })]
    expect(toDownloads({ dl_info_speed: 0 }, list).torrents.map((t) => t.hash)).toEqual(['vero'])
  })
})

describe('toDetail', () => {
  it('aggiunge i dati del torrent e i file', () => {
    const detail = toDetail(
      torrent({
        hash: 'x',
        downloaded: 5,
        upspeed: 7,
        ratio: 1.5,
        save_path: '/downloads',
        added_on: 1_700_000_000,
      }),
      [
        { index: 0, name: 'a.iso', size: 10, progress: 0.5, priority: 1 },
        { index: 1, name: 'b.txt', size: 1, progress: 0, priority: 0 },
      ],
    )
    expect(detail).toMatchObject({
      hash: 'x',
      downloaded: 5,
      uploadSpeed: 7,
      ratio: 1.5,
      savePath: '/downloads',
      addedAt: '2023-11-14T22:13:20.000Z',
    })
    expect(detail.files).toEqual([
      { index: 0, name: 'a.iso', size: 10, progress: 0.5, selected: true },
      { index: 1, name: 'b.txt', size: 1, progress: 0, selected: false },
    ])
  })

  it('senza i campi opzionali usa zero e stringa vuota', () => {
    const detail = toDetail(torrent({}), [{ index: 0, name: 'a', size: 1 }])
    expect(detail).toMatchObject({ downloaded: 0, uploadSpeed: 0, ratio: 0, savePath: '' })
    expect(detail.files[0]).toMatchObject({ progress: 0, selected: true })
  })
})

describe('parseAction', () => {
  const hash = 'a'.repeat(40)

  it('accetta un’azione con gli infohash', () => {
    expect(parseAction({ action: 'delete', hashes: [hash], deleteFiles: true })).toEqual({
      action: 'delete',
      hashes: [hash],
      deleteFiles: true,
    })
    expect(parseAction({ action: 'pause', hashes: [hash.toUpperCase()] }).deleteFiles).toBe(false)
  })

  it.each([
    ['senza corpo', undefined],
    ['azione sconosciuta', { action: 'reboot', hashes: [hash] }],
    ['nessun infohash', { action: 'pause', hashes: [] }],
    ['infohash non valido', { action: 'pause', hashes: ['../x'] }],
    ['troppi infohash', { action: 'pause', hashes: Array(101).fill(hash) }],
    ['deleteFiles non booleano', { action: 'delete', hashes: [hash], deleteFiles: 'si' }],
  ])('rifiuta %s', (_, body) => {
    expect(() => parseAction(body)).toThrow(InvalidActionError)
  })
})

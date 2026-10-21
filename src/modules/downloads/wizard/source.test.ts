import { describe, expect, it } from 'vitest'

import { isReady, isTorrentFile, parseLink, EMPTY_SOURCE } from './source'

describe('parseLink', () => {
  it.each([
    [
      'magnet:?xt=urn:btih:3b1a1469c180f447b77021074dbbccaef62611e7&dn=debian',
      { kind: 'magnet', version: 'v1' },
    ],
    ['  magnet:?dn=x&xt=urn:btmh:1220abcd  ', { kind: 'magnet', version: 'v2' }],
    ['https://cdimage.debian.org/debian-13.torrent', { kind: 'url' }],
    ['http://example.com/a', { kind: 'url' }],
  ])('%s è valido', (text, link) => expect(parseLink(text)).toEqual(link))

  it.each(['magnet:?dn=senza-hash', 'ftp://example.com/a.torrent', 'ciao', '', 'https://'])(
    '%j non è valido',
    (text) => expect(parseLink(text)).toBeNull(),
  )
})

describe('isTorrentFile', () => {
  it('accetta solo .torrent non vuoti fino a 10 MB', () => {
    expect(isTorrentFile(new File(['d'], 'a.torrent'))).toBe(true)
    expect(isTorrentFile(new File(['d'], 'A.TORRENT'))).toBe(true)
    expect(isTorrentFile(new File(['d'], 'a.txt'))).toBe(false)
    expect(isTorrentFile(new File([], 'a.torrent'))).toBe(false)
    expect(isTorrentFile(new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'a.torrent'))).toBe(false)
  })
})

describe('isReady', () => {
  it('dipende dalla scheda attiva', () => {
    const file = new File(['d'], 'a.torrent')
    expect(isReady(EMPTY_SOURCE)).toBe(false)
    expect(isReady({ ...EMPTY_SOURCE, file })).toBe(true)
    expect(isReady({ ...EMPTY_SOURCE, file, fileError: true })).toBe(false)
    expect(isReady({ ...EMPTY_SOURCE, file, tab: 'link' })).toBe(false)
    expect(isReady({ ...EMPTY_SOURCE, tab: 'link', link: 'magnet:?xt=urn:btih:abc' })).toBe(true)
  })
})

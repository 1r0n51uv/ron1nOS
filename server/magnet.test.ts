// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { parseMagnet } from './magnet.ts'

const HEX = '3b1a1469c180f447b77021074dbbccaef62611e7'

describe('parseMagnet', () => {
  it('legge infohash v1 esadecimale e nome', () => {
    expect(parseMagnet(`magnet:?xt=urn:btih:${HEX.toUpperCase()}&dn=debian-13.iso`)).toEqual({
      infoHash: HEX,
      name: 'debian-13.iso',
    })
  })

  it('converte l’infohash v1 in base32', () => {
    // Stesso hash di HEX in base32.
    expect(parseMagnet('magnet:?xt=urn:btih:HMNBI2OBQD2EPN3QEEDU3O6MV33CMEPH')?.infoHash).toBe(HEX)
  })

  it('tronca l’hash v2 a 40 caratteri', () => {
    const v2 = 'a'.repeat(64)
    expect(parseMagnet(`magnet:?xt=urn:btmh:1220${v2}`)).toEqual({ infoHash: 'a'.repeat(40), name: null })
  })

  it('negli ibridi usa l’hash v1', () => {
    const link = `magnet:?xt=urn:btmh:1220${'b'.repeat(64)}&xt=urn:btih:${HEX}`
    expect(parseMagnet(link)?.infoHash).toBe(HEX)
  })

  it.each(['magnet:?dn=x', 'magnet:?xt=urn:btih:123', 'https://example.com', 'magnet:?xt=urn:btmh:1114abcd'])(
    'rifiuta %s',
    (link) => expect(parseMagnet(link)).toBeNull(),
  )
})

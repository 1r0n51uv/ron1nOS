// Link magnet: infohash e nome, come li identifica qBittorrent.

export type Magnet = { infoHash: string; name: string | null }

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function base32ToHex(text: string) {
  let bits = ''
  for (const c of text.toUpperCase()) {
    const v = BASE32.indexOf(c)
    if (v < 0) return null
    bits += v.toString(2).padStart(5, '0')
  }
  let hex = ''
  for (let i = 0; i + 4 <= bits.length; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16)
  return hex
}

export function parseMagnet(link: string): Magnet | null {
  const text = link.trim()
  if (!/^magnet:\?/i.test(text)) return null
  const params = new URLSearchParams(text.slice(text.indexOf('?') + 1))
  const xts = params.getAll('xt')
  let infoHash: string | null = null
  for (const xt of xts) {
    const v1 = /^urn:btih:([0-9a-f]{40}|[a-z2-7]{32})$/i.exec(xt)
    if (v1) {
      infoHash = v1[1].length === 40 ? v1[1].toLowerCase() : base32ToHex(v1[1])
      break // con un ibrido qBittorrent usa l'hash v1
    }
    // v2: multihash sha2-256 (1220…); qBittorrent lo tronca a 40 caratteri.
    const v2 = /^urn:btmh:1220([0-9a-f]{64})$/i.exec(xt)
    if (v2) infoHash = v2[1].slice(0, 40).toLowerCase()
  }
  if (!infoHash) return null
  return { infoHash, name: params.get('dn') }
}

// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { BencodeError, decode, encode } from './bencode.ts'

describe('bencode', () => {
  it('decodifica interi, stringhe, liste e dizionari', () => {
    const { value } = decode(Buffer.from('d1:ai-3e1:bl4:spami0eee'))
    expect(value).toEqual({ a: -3, b: [Buffer.from('spam'), 0] })
  })

  it('ritrova il tratto grezzo di info', () => {
    const buf = encode({ announce: 'x', info: { name: 'n', length: 1 } })
    const { info } = decode(buf)
    expect(buf.subarray(info!.start, info!.end).toString()).toBe('d6:lengthi1e4:name1:ne')
  })

  it.each(['', 'i01e', 'i-0e', '3:ab', 'l', 'd1:a', 'x', 'i1ei2e', '01:a'])('rifiuta %j', (text) => {
    expect(() => decode(Buffer.from(text))).toThrow(BencodeError)
  })

  it('rifiuta annidamenti troppo profondi', () => {
    expect(() => decode(Buffer.from('l'.repeat(100) + 'e'.repeat(100)))).toThrow(BencodeError)
  })

  it('encode è l’inverso di decode', () => {
    const buf = encode({ z: [1, 'due'], a: { b: 'c' } })
    expect(encode(decode(buf).value)).toEqual(buf)
  })
})

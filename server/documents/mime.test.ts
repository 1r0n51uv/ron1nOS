import { describe, expect, it } from 'vitest'

import { isImage, sniffMime } from './mime.ts'

const bytes = (...b: number[]) => Buffer.from(b)

describe('tipo dai byte (DOC-011)', () => {
  it('riconosce immagini e PDF', () => {
    expect(sniffMime(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg')
    expect(sniffMime(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe('image/png')
    expect(sniffMime(Buffer.from('RIFF\0\0\0\0WEBPVP8 '))).toBe('image/webp')
    expect(sniffMime(Buffer.from('GIF89a'))).toBe('image/gif')
    expect(sniffMime(Buffer.from('%PDF-1.7'))).toBe('application/pdf')
    expect(sniffMime(Buffer.from('\0\0\0\x18ftypheic'))).toBe('image/heic')
    expect(sniffMime(bytes(0x50, 0x4b, 0x03, 0x04))).toBe('application/zip')
  })

  it('il resto, anche un HTML, resta da scaricare', () => {
    expect(sniffMime(Buffer.from('<html><script>'))).toBe('application/octet-stream')
    expect(sniffMime(Buffer.alloc(0))).toBe('application/octet-stream')
  })

  it('isImage', () => {
    expect(isImage('image/png')).toBe(true)
    expect(isImage('application/pdf')).toBe(false)
  })
})

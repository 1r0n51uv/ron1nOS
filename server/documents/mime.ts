// Tipo di un allegato ricavato dai primi byte (DOC-011), non dall'estensione:
// un .jpg che è un PDF si mostra come PDF. Riconosce quello che ha
// un'anteprima; il resto resta application/octet-stream e si scarica.
export const PREVIEWABLE = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'])

const startsWith = (buf: Buffer, bytes: number[], offset = 0) =>
  buf.length >= offset + bytes.length && bytes.every((b, i) => buf[offset + i] === b)

const ascii = (buf: Buffer, start: number, end: number) => buf.subarray(start, end).toString('latin1')

export function sniffMime(buf: Buffer): string {
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return 'image/jpeg'
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png'
  if (ascii(buf, 0, 4) === 'RIFF' && ascii(buf, 8, 12) === 'WEBP') return 'image/webp'
  if (ascii(buf, 0, 6) === 'GIF87a' || ascii(buf, 0, 6) === 'GIF89a') return 'image/gif'
  if (ascii(buf, 0, 5) === '%PDF-') return 'application/pdf'
  if (ascii(buf, 4, 8) === 'ftyp' && /^(heic|heix|mif1|msf1|hevc)$/.test(ascii(buf, 8, 12)))
    return 'image/heic'
  if (startsWith(buf, [0x50, 0x4b, 0x03, 0x04])) return 'application/zip'
  return 'application/octet-stream'
}

export const isImage = (mime: string) => mime.startsWith('image/')

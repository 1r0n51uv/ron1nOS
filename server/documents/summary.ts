// PDF di riepilogo (DOC-013): A4 generato al volo e mai salvato. In alto
// titolo, titolare e scadenza, poi le immagini allegate e i campi; gli
// allegati PDF si accodano come pagine, gli altri file sono solo elencati.
import type { PDFFont, PDFImage, PDFPage } from 'pdf-lib'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import sharp from 'sharp'

import type { FileMeta } from './files.ts'
import type { StoredDocument } from './store.ts'
import type { TypeField } from './types.ts'

const A4: [number, number] = [595.28, 841.89]
const MARGIN = 48
const INK = rgb(0.1, 0.1, 0.1)
const MUTED = rgb(0.45, 0.45, 0.45)

export type SummaryInput = {
  doc: StoredDocument
  typeName: string | null
  fields: TypeField[]
  files: FileMeta[]
  // Contenuto in chiaro di un allegato.
  content: (file: FileMeta) => Promise<Buffer | null>
}

const itDate = (day: string) => day.split('-').reverse().join('/')

// I font standard coprono solo WinAnsi: il resto diventa `?`.
function safe(font: PDFFont, text: string) {
  const known = new Set(font.getCharacterSet())
  return [...text.replace(/\s+/g, ' ')].map((c) => (known.has(c.codePointAt(0)!) ? c : '?')).join('')
}

// Righe che stanno nella larghezza, a capo sulle parole.
function wrap(font: PDFFont, size: number, text: string, width: number) {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word
    if (font.widthOfTextAtSize(next, size) <= width || !line) line = next
    else {
      lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  return lines
}

async function embedImage(pdf: PDFDocument, file: FileMeta, data: Buffer): Promise<PDFImage | null> {
  try {
    if (file.mime === 'image/jpeg') return await pdf.embedJpg(data)
    if (file.mime === 'image/png') return await pdf.embedPng(data)
    // WebP, GIF, HEIC: passano da sharp, se le sa leggere.
    return await pdf.embedJpg(await sharp(data).rotate().jpeg({ quality: 85 }).toBuffer())
  } catch {
    return null
  }
}

export async function summaryPdf({
  doc,
  typeName,
  fields,
  files,
  content,
}: SummaryInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  pdf.setTitle(doc.title)
  pdf.setProducer('ron1nOS')
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const width = A4[0] - MARGIN * 2

  let page: PDFPage = pdf.addPage(A4)
  let y = A4[1] - MARGIN
  const room = (needed: number) => {
    if (y - needed < MARGIN) {
      page = pdf.addPage(A4)
      y = A4[1] - MARGIN
    }
  }
  const text = (
    value: string,
    opts: { size?: number; font?: PDFFont; color?: typeof INK; x?: number; w?: number },
  ) => {
    const { size = 11, font = regular, color = INK, x = MARGIN, w = width } = opts
    for (const line of wrap(font, size, safe(font, value), w)) {
      room(size + 4)
      y -= size + 4
      page.drawText(line, { x, y, size, font, color })
    }
  }

  text(doc.title, { size: 22, font: bold })
  y -= 4
  const meta = [typeName ?? 'File', doc.holder, doc.expiresOn ? `Scade il ${itDate(doc.expiresOn)}` : null]
  text(meta.filter(Boolean).join(' · '), { color: MUTED })
  y -= 12

  // Immagini: due per riga, proporzioni mantenute.
  const images: { image: PDFImage; label: string }[] = []
  const pdfs: Buffer[] = []
  const others: FileMeta[] = []
  for (const file of files) {
    const data = await content(file)
    if (!data) continue
    if (file.mime === 'application/pdf') pdfs.push(data)
    else if (file.mime.startsWith('image/')) {
      const image = await embedImage(pdf, file, data)
      if (image) images.push({ image, label: file.label })
      else others.push(file)
    } else others.push(file)
  }
  const cell = (width - 16) / 2
  for (let i = 0; i < images.length; i += 2) {
    const row = images
      .slice(i, i + 2)
      .map(({ image, label }) => ({ ...image.scaleToFit(cell, 300), image, label }))
    const height = Math.max(...row.map((r) => r.height)) + 18
    room(height)
    row.forEach((r, j) => {
      const x = MARGIN + j * (cell + 16)
      page.drawImage(r.image, { x, y: y - r.height, width: r.width, height: r.height })
      page.drawText(r.label, { x, y: y - r.height - 12, size: 9, font: regular, color: MUTED })
    })
    y -= height + 8
  }

  // Campi del tipo, poi i campi liberi.
  const rows: [string, string][] = [
    ...fields
      .filter((f) => doc.fields[f.key])
      .map((f): [string, string] => [
        f.label,
        f.kind === 'date' ? itDate(doc.fields[f.key]) : doc.fields[f.key],
      ]),
    ...doc.extra.map((e): [string, string] => [e.label, e.value]),
  ]
  if (rows.length) {
    y -= 6
    for (const [label, value] of rows) {
      const lines = wrap(regular, 11, safe(regular, value), width - 170)
      room(lines.length * 15 + 6)
      page.drawText(safe(regular, label), { x: MARGIN, y: y - 15, size: 10, font: regular, color: MUTED })
      for (const line of lines) {
        y -= 15
        page.drawText(line, { x: MARGIN + 170, y, size: 11, font: regular, color: INK })
      }
      y -= 6
    }
  }
  if (doc.notes) {
    y -= 8
    text('Note', { size: 10, color: MUTED })
    text(doc.notes, {})
  }
  if (others.length) {
    y -= 8
    text('Altri allegati', { size: 10, color: MUTED })
    for (const f of others) text(f.name, {})
  }

  // Gli allegati PDF in coda; uno illeggibile o protetto si salta.
  for (const data of pdfs) {
    try {
      const source = await PDFDocument.load(data)
      const pages = await pdf.copyPages(source, source.getPageIndices())
      for (const p of pages) pdf.addPage(p)
    } catch {
      // resta solo il resto del riepilogo
    }
  }

  return pdf.save()
}

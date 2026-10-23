// @vitest-environment node
import { PDFDocument } from 'pdf-lib'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import type { FileMeta } from './files.ts'
import type { StoredDocument } from './store.ts'
import { summaryPdf } from './summary.ts'

const doc: StoredDocument = {
  id: 'd1',
  typeId: 't',
  title: 'Carta d’identità · Città',
  holder: 'Io',
  expiresOn: '2027-04-12',
  warnings: [90, 30, 7],
  tags: [],
  pinnedAt: null,
  fields: { number: 'CA00000AA', birth_date: '1990-04-12' },
  extra: [{ label: 'PIN 🔒', value: 'x'.repeat(300) }],
  notes: 'Nel cassetto',
  createdAt: '2026-10-22T10:00:00Z',
  updatedAt: '2026-10-22T10:00:00Z',
}

const meta = (id: string, mime: string, label: FileMeta['label'] = 'altro'): FileMeta => ({
  id,
  name: `${id}.bin`,
  mime,
  size: 1,
  label,
  position: 0,
  hasThumb: false,
  createdAt: '2026-10-22T10:00:00Z',
})

async function attachedPdf(pages: number) {
  const pdf = await PDFDocument.create()
  for (let i = 0; i < pages; i++) pdf.addPage()
  return Buffer.from(await pdf.save())
}

describe('PDF di riepilogo (DOC-013)', () => {
  it('immagini e campi nella prima pagina, gli allegati PDF in coda', async () => {
    const png = await sharp({ create: { width: 800, height: 500, channels: 3, background: '#c00' } })
      .png()
      .toBuffer()
    const webp = await sharp({ create: { width: 300, height: 300, channels: 3, background: '#0c0' } })
      .webp()
      .toBuffer()
    const contents: Record<string, Buffer> = {
      front: png,
      back: webp,
      contract: await attachedPdf(2),
      zip: Buffer.from('PK'),
    }
    const out = await summaryPdf({
      doc,
      typeName: "Carta d'identità",
      fields: [
        { key: 'number', label: 'Numero', kind: 'code', copyable: true },
        { key: 'birth_date', label: 'Data di nascita', kind: 'date', copyable: true },
      ],
      files: [
        meta('front', 'image/png', 'fronte'),
        meta('back', 'image/webp', 'retro'),
        meta('contract', 'application/pdf'),
        meta('zip', 'application/zip'),
      ],
      content: async (f) => contents[f.id] ?? null,
    })
    const pdf = await PDFDocument.load(out)
    expect(pdf.getTitle()).toBe('Carta d’identità · Città')
    expect(pdf.getPageCount()).toBe(3)
    const [w, h] = [pdf.getPage(0).getWidth(), pdf.getPage(0).getHeight()]
    expect([Math.round(w), Math.round(h)]).toEqual([595, 842])
  })

  it('un PDF allegato rotto non ferma il riepilogo', async () => {
    const out = await summaryPdf({
      doc: { ...doc, extra: [], notes: '' },
      typeName: null,
      fields: [],
      files: [meta('bad', 'application/pdf')],
      content: async () => Buffer.from('%PDF-rotto'),
    })
    expect((await PDFDocument.load(out)).getPageCount()).toBe(1)
  })
})

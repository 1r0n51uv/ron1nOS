import { expect, test } from '@playwright/test'

// API dei documenti (DOC-005, DOC-011, DOC-012, DOC-014) sul backend vero:
// crea, carica un allegato, lo riscarica uguale, elimina.
const PDF = Buffer.from('%PDF-1.4\n% contratto di prova\n')

test('documento con allegato: crea, scarica, elimina', async ({ request }) => {
  const created = await request.post('/api/v1/documents/documents', {
    data: { title: 'Contratto affitto', extra: [{ label: 'Codice', value: 'RM-2026' }], tags: ['casa'] },
  })
  expect(created.status()).toBe(201)
  const doc = (await created.json()) as { id: string; holder: string }
  expect(doc.holder).toBe('Io')

  const uploaded = await request.post(`/api/v1/documents/documents/${doc.id}/files`, {
    multipart: {
      file: { name: 'contratto.pdf', mimeType: 'application/octet-stream', buffer: PDF },
      label: 'pagina',
    },
  })
  expect(uploaded.status()).toBe(201)
  const file = (await uploaded.json()) as { id: string; mime: string }
  expect(file.mime).toBe('application/pdf')

  const list = await request.get('/api/v1/documents/documents?q=casa')
  expect(await list.json()).toMatchObject([{ title: 'Contratto affitto', files: 1 }])

  const download = await request.get(`/api/v1/documents/documents/${doc.id}/files/${file.id}?download=1`)
  expect(download.headers()['cache-control']).toBe('no-store')
  expect(download.headers()['content-disposition']).toContain('contratto.pdf')
  expect(Buffer.from(await download.body()).equals(PDF)).toBe(true)

  expect((await request.delete(`/api/v1/documents/documents/${doc.id}`)).status()).toBe(204)
  expect((await request.get(`/api/v1/documents/documents/${doc.id}`)).status()).toBe(404)
})

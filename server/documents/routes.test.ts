// @vitest-environment node
import { randomBytes } from 'node:crypto'

import sharp from 'sharp'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createApp } from '../app.ts'
import { hashPassword } from '../auth/password.ts'
import { SESSION_COOKIE } from '../auth/routes.ts'
import { createSession } from '../auth/sessions.ts'
import { fakeQbt } from '../testing/fake-qbt.ts'
import { testDb } from '../testing/db.ts'
import { createVault } from './crypto.ts'
import type { FileMeta } from './files.ts'

let db: Awaited<ReturnType<typeof testDb>>
let cookie: string
let app: ReturnType<typeof createApp>
let identityCard: string
let passport: string

beforeAll(async () => {
  db = await testDb()
  const { token } = await createSession(db)
  cookie = `${SESSION_COOKIE}=${token}`
  app = createApp({
    qbt: fakeQbt(),
    database: { db, status: () => 'ok' },
    auth: { passwordHash: await hashPassword('una password abbastanza lunga') },
    documents: { vault: createVault(randomBytes(32)), now: () => new Date('2026-10-22T10:00:00Z') },
  })
  const { rows } = await db.query<{ id: string; key: string }>('select id, key from document_types')
  identityCard = rows.find((r) => r.key === 'identity_card')!.id
  passport = rows.find((r) => r.key === 'passport')!.id
})
afterAll(() => db.drop())
beforeEach(() => db.query('delete from documents'))

async function call(method: string, path: string, body?: unknown) {
  const res = await app.request(`/api/v1/documents${path}`, {
    method,
    headers: { cookie, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = res.headers.get('content-type')?.includes('json') ? await res.text() : ''
  return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null }
}

const get = (path: string) => call('GET', path)
const post = (path: string, body: unknown) => call('POST', path, body)
const patch = (path: string, body: unknown) => call('PATCH', path, body)

function upload(id: string, content: Buffer, name: string, label?: string) {
  const form = new FormData()
  form.append('file', new File([new Uint8Array(content)], name))
  if (label) form.append('label', label)
  return app.request(`/api/v1/documents/documents/${id}/files`, {
    method: 'POST',
    headers: { cookie },
    body: form,
  })
}

const png = () =>
  sharp({ create: { width: 1200, height: 800, channels: 3, background: '#c00' } })
    .png()
    .toBuffer()

describe('documenti (DOC-005, DOC-006, DOC-007)', () => {
  it('crea un documento con tipo, campi e campi liberi; il dettaglio li rilegge', async () => {
    const res = await post('/documents', {
      typeId: identityCard,
      title: 'Carta d’identità',
      fields: { number: 'CA00000AA', birth_date: '1990-05-01', surname: ' ' },
      extra: [{ label: 'PIN', value: '1234' }],
      expiresOn: '2027-01-10',
      tags: ['identità', 'identità'],
    })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({
      title: 'Carta d’identità',
      holder: 'Io',
      fields: { number: 'CA00000AA', birth_date: '1990-05-01' },
      extra: [{ label: 'PIN', value: '1234' }],
      tags: ['identità'],
      warnings: [90, 30, 7],
      type: { name: "Carta d'identità" },
      expiry: { status: 'expiring', daysLeft: 80 },
      files: [],
    })
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect((await get(`/documents/${res.body.id}`)).body.fields.number).toBe('CA00000AA')
  })

  it('solo il titolo è obbligatorio: file libero', async () => {
    const res = await post('/documents', { title: 'Contratto affitto.pdf' })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ typeId: null, type: null, fields: {}, extra: [], notes: '' })
    expect((await post('/documents', { title: '  ' })).status).toBe(400)
  })

  it('rifiuta campi sconosciuti, date sbagliate, tipi inesistenti e campi senza tipo', async () => {
    const bad = [
      { typeId: identityCard, title: 'x', fields: { colore: 'rosso' } },
      { typeId: identityCard, title: 'x', fields: { birth_date: '01/05/1990' } },
      { typeId: '00000000-0000-4000-8000-000000000000', title: 'x' },
      { title: 'x', fields: { number: '1' } },
      { title: 'x', warnings: [15] },
      { title: 'x', expiresOn: '2027-13-01' },
      { title: 'x', extra: Array.from({ length: 31 }, (_, i) => ({ label: `c${i}`, value: 'v' })) },
    ]
    for (const body of bad) expect((await post('/documents', body)).status).toBe(400)
  })

  it('cambio di tipo: i valori che il nuovo tipo non ha diventano campi liberi', async () => {
    const { body: doc } = await post('/documents', {
      typeId: identityCard,
      title: 'Documento',
      fields: { number: 'CA1', birth_place: 'Napoli' },
    })
    const res = await patch(`/documents/${doc.id}`, { typeId: passport })
    expect(res.status).toBe(200)
    expect(res.body.fields).toEqual({ number: 'CA1' })
    expect(res.body.extra).toEqual([{ label: 'Luogo di nascita', value: 'Napoli' }])
    const free = await patch(`/documents/${doc.id}`, { typeId: null })
    expect(free.body.fields).toEqual({})
    expect(free.body.extra.map((e: { label: string }) => e.label)).toEqual(['Luogo di nascita', 'Numero'])
  })

  it('modifica parziale: il resto resta com’era', async () => {
    const { body: doc } = await post('/documents', { title: 'Polizza', notes: 'auto', holder: 'Anna' })
    const res = await patch(`/documents/${doc.id}`, { title: 'Polizza auto' })
    expect(res.body).toMatchObject({ title: 'Polizza auto', notes: 'auto', holder: 'Anna' })
    expect(Date.parse(res.body.updatedAt)).toBeGreaterThanOrEqual(Date.parse(doc.updatedAt))
  })

  it('titolari già usati, i più frequenti per primi', async () => {
    await post('/documents', { title: 'a', holder: 'Anna' })
    await post('/documents', { title: 'b', holder: 'Anna' })
    await post('/documents', { title: 'c' })
    expect((await get('/holders')).body).toEqual(['Anna', 'Io'])
  })

  it('id sconosciuti o malformati: 404', async () => {
    expect((await get('/documents/nope')).status).toBe(404)
    expect((await get('/documents/00000000-0000-4000-8000-000000000000')).status).toBe(404)
    expect((await call('DELETE', '/documents/00000000-0000-4000-8000-000000000000')).status).toBe(404)
  })
})

describe('elenco, ricerca ed evidenza (DOC-002, DOC-008, DOC-010)', () => {
  it('prima i fissati nell’ordine in cui sono stati fissati, poi gli altri per titolo', async () => {
    const b = await post('/documents', { title: 'B' })
    const a = await post('/documents', { title: 'A' })
    const z = await post('/documents', { title: 'Z', pinned: true })
    await patch(`/documents/${b.body.id}`, { pinned: true })
    expect((await get('/documents')).body.map((d: { title: string }) => d.title)).toEqual(['Z', 'B', 'A'])
    // Rifissare un documento già fissato non cambia l’ordine.
    await patch(`/documents/${z.body.id}`, { pinned: true, title: 'Z2' })
    expect((await get('/documents')).body.map((d: { title: string }) => d.title)).toEqual(['Z2', 'B', 'A'])
    await patch(`/documents/${z.body.id}`, { pinned: false })
    expect((await get('/documents')).body[0].title).toBe('B')
    expect(a.status).toBe(201)
  })

  it('cerca per titolo e tag, filtra per tipo e titolare; niente valori dei campi', async () => {
    await post('/documents', { typeId: passport, title: 'Passaporto', fields: { number: 'YA123' } })
    await post('/documents', { title: 'Bolletta', tags: ['casa'], holder: 'Anna' })
    const all = (await get('/documents')).body
    expect(JSON.stringify(all)).not.toContain('YA123')
    expect(all.find((d: { title: string }) => d.title === 'Passaporto')).toMatchObject({
      typeName: 'Passaporto',
      typeIcon: 'passport',
      files: 0,
      thumbFileId: null,
    })
    const titles = async (q: string) =>
      (await get(`/documents?${q}`)).body.map((d: { title: string }) => d.title)
    expect(await titles('q=bollet')).toEqual(['Bolletta'])
    expect(await titles('q=CASA')).toEqual(['Bolletta'])
    expect(await titles('q=%25')).toEqual([])
    expect(await titles(`type=${passport}`)).toEqual(['Passaporto'])
    expect(await titles('type=none')).toEqual(['Bolletta'])
    expect(await titles('holder=Anna')).toEqual(['Bolletta'])
    expect((await get('/documents?type=boh')).status).toBe(400)
  })

  it('stato della scadenza calcolato dal server', async () => {
    await post('/documents', { title: 'Scaduto', expiresOn: '2026-10-21' })
    await post('/documents', { title: 'In scadenza', expiresOn: '2026-11-20' })
    await post('/documents', { title: 'Solo 7', expiresOn: '2026-11-20', warnings: [7] })
    const byTitle = Object.fromEntries(
      (await get('/documents')).body.map((d: { title: string; expiry: unknown }) => [d.title, d.expiry]),
    )
    expect(byTitle).toEqual({
      Scaduto: { status: 'expired', daysLeft: -1 },
      'In scadenza': { status: 'expiring', daysLeft: 29 },
      'Solo 7': { status: 'ok', daysLeft: 29 },
    })
  })
})

describe('allegati (DOC-011, DOC-012, DOC-014)', () => {
  it('carica un’immagine: tipo dai byte, miniatura, download con il nome originale', async () => {
    const { body: doc } = await post('/documents', { title: 'CIE' })
    const image = await png()
    const res = await upload(doc.id, image, 'fronte.jpg', 'fronte')
    expect(res.status).toBe(201)
    const meta = (await res.json()) as FileMeta
    expect(meta).toMatchObject({ name: 'fronte.jpg', mime: 'image/png', size: image.length, label: 'fronte' })
    expect(meta.hasThumb).toBe(true)

    const file = await app.request(`/api/v1/documents/documents/${doc.id}/files/${meta.id}?download=1`, {
      headers: { cookie },
    })
    expect(Buffer.from(await file.arrayBuffer()).equals(image)).toBe(true)
    expect(file.headers.get('content-type')).toBe('image/png')
    expect(file.headers.get('content-disposition')).toBe("attachment; filename*=UTF-8''fronte.jpg")
    expect(file.headers.get('cache-control')).toBe('no-store')

    const thumb = await app.request(`/api/v1/documents/documents/${doc.id}/files/${meta.id}?variant=thumb`, {
      headers: { cookie },
    })
    const size = await sharp(Buffer.from(await thumb.arrayBuffer())).metadata()
    expect([size.format, size.width, size.height]).toEqual(['jpeg', 400, 267])

    const list = (await get('/documents')).body[0]
    expect(list).toMatchObject({ files: 1, thumbFileId: meta.id })
  })

  it('nel database il file è cifrato', async () => {
    const { body: doc } = await post('/documents', { title: 'Nota' })
    await upload(doc.id, Buffer.from('testo segreto del contratto'), 'nota.txt')
    const { rows } = await db.query<{ ciphertext: Buffer; thumb: Buffer | null; mime: string }>(
      'select ciphertext, thumb, mime from document_files',
    )
    expect(rows[0].ciphertext.toString('latin1')).not.toContain('segreto')
    expect(rows[0]).toMatchObject({ thumb: null, mime: 'application/octet-stream' })
  })

  it('etichetta e ordine; elimina un allegato e poi il documento', async () => {
    const { body: doc } = await post('/documents', { title: 'Patente' })
    const ids: string[] = []
    for (const name of ['a.pdf', 'b.pdf', 'c.pdf']) {
      ids.push(((await (await upload(doc.id, Buffer.from('%PDF-1.4 x'), name)).json()) as FileMeta).id)
    }
    const moved = await patch(`/documents/${doc.id}/files/${ids[2]}`, { position: 0, label: 'retro' })
    expect(moved.body).toMatchObject({ position: 0, label: 'retro', mime: 'application/pdf' })
    const names = async () =>
      (await get(`/documents/${doc.id}`)).body.files.map((f: { name: string }) => f.name)
    expect(await names()).toEqual(['c.pdf', 'a.pdf', 'b.pdf'])
    expect((await patch(`/documents/${doc.id}/files/${ids[0]}`, { label: 'boh' })).status).toBe(400)

    expect((await call('DELETE', `/documents/${doc.id}/files/${ids[0]}`)).status).toBe(204)
    expect(await names()).toEqual(['c.pdf', 'b.pdf'])
    expect((await call('DELETE', `/documents/${doc.id}`)).status).toBe(204)
    const { rows } = await db.query('select * from document_files')
    expect(rows).toEqual([])
  })

  it('oltre 20 MB: 413', async () => {
    const { body: doc } = await post('/documents', { title: 'Grande' })
    const res = await upload(doc.id, Buffer.alloc(20 * 1024 * 1024 + 1), 'grande.bin')
    expect(res.status).toBe(413)
    expect(((await res.json()) as { error: string }).error).toBe('file_too_large')
  })

  it('senza file o su un documento inesistente', async () => {
    const res = await app.request('/api/v1/documents/documents/00000000-0000-4000-8000-000000000000/files', {
      method: 'POST',
      headers: { cookie },
      body: new FormData(),
    })
    expect(res.status).toBe(400)
    const missing = await upload('00000000-0000-4000-8000-000000000000', Buffer.from('x'), 'x.txt')
    expect(missing.status).toBe(404)
  })
})

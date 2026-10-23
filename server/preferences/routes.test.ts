// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createApp } from '../app.ts'
import type { Database } from '../db.ts'
import { testDb } from '../testing/db.ts'
import { fakeQbt } from '../testing/fake-qbt.ts'
import { DEFAULT_PREFERENCES } from './schema.ts'

let db: Awaited<ReturnType<typeof testDb>>
beforeAll(async () => {
  db = await testDb()
})
afterAll(() => db.drop())
beforeEach(() => db.query('delete from preferences; delete from preference_background'))

function api(database: Database = { db, status: () => 'ok' }) {
  const app = createApp({ qbt: fakeQbt(), database })
  const call = async (method: string, body?: unknown) => {
    const res = await app.request('/api/v1/preferences', {
      method,
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    return { status: res.status, body: JSON.parse(await res.text()) }
  }
  const upload = async (content: Uint8Array, name = 'sfondo.png') => {
    const form = new FormData()
    form.append('file', new File([content], name))
    const res = await app.request('/api/v1/preferences/background', { method: 'PUT', body: form })
    return { status: res.status, body: JSON.parse(await res.text()) }
  }
  return {
    get: () => call('GET'),
    patch: (body: unknown) => call('PATCH', body),
    upload,
    image: () => app.request('/api/v1/preferences/background'),
    removeImage: async () => {
      const res = await app.request('/api/v1/preferences/background', { method: 'DELETE' })
      return { status: res.status, body: JSON.parse(await res.text()) }
    },
  }
}

describe('rotte delle preferenze (SET-002)', () => {
  it('senza preferenze salvate restituisce i predefiniti', async () => {
    expect(await api().get()).toEqual({
      status: 200,
      body: { ...DEFAULT_PREFERENCES, updatedAt: null, backgroundImage: null, stored: true },
    })
  })

  it('salva una modifica parziale e la rilegge', async () => {
    const res = await api().patch({ appearance: { density: 'compact' }, disabledModules: ['notes'] })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      appearance: { background: 'brace', glass: 'medium', density: 'compact' },
      disabledModules: ['notes'],
      stored: true,
    })
    expect(res.body.updatedAt).toEqual(expect.any(String))
    await api().patch({ formats: { energyUnit: 'kJ' } })
    const read = (await api().get()).body
    expect(read.appearance.density).toBe('compact')
    expect(read.disabledModules).toEqual(['notes'])
    expect(read.formats.energyUnit).toBe('kJ')
  })

  it('rifiuta con 400 valori non previsti, senza salvare', async () => {
    const res = await api().patch({ appearance: { glass: 'opaco' } })
    expect(res).toEqual({
      status: 400,
      body: { error: 'invalid_request', message: 'Campo non valido: appearance.glass' },
    })
    expect((await api().patch({ colore: 'rosso' })).status).toBe(400)
    expect((await api().get()).body.updatedAt).toBeNull()
  })

  it('senza database legge i predefiniti con stored false e non salva', async () => {
    const offline = api({ status: () => 'disabled' })
    expect((await offline.get()).body).toMatchObject({ ...DEFAULT_PREFERENCES, stored: false })
    expect((await offline.patch({ appearance: { glass: 'light' } })).status).toBe(503)
  })
})

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 1, 2, 3])

describe('immagine di sfondo (SET-003)', () => {
  it('si carica, si mette in uso e si rilegge con il suo tipo', async () => {
    const res = await api().upload(PNG)
    expect(res.status).toBe(200)
    expect(res.body.appearance.background).toBe('image')
    expect(res.body.backgroundImage).toEqual(expect.any(String))
    const image = await api().image()
    expect(image.status).toBe(200)
    expect(image.headers.get('content-type')).toBe('image/png')
    expect(new Uint8Array(await image.arrayBuffer())).toEqual(PNG)
  })

  it('rifiuta un file che non è JPEG, PNG o WebP, qualunque sia il nome', async () => {
    const res = await api().upload(new TextEncoder().encode('%PDF-1.7'), 'finto.png')
    expect(res).toEqual({
      status: 400,
      body: { error: 'invalid_request', message: 'Serve un’immagine JPEG, PNG o WebP' },
    })
  })

  it('rifiuta con 413 un’immagine oltre i 5 MB', async () => {
    const big = new Uint8Array(5 * 1024 * 1024 + 1)
    big.set(PNG)
    expect((await api().upload(big)).status).toBe(413)
  })

  it('senza immagine caricata lo sfondo `image` non si può scegliere', async () => {
    const res = await api().patch({ appearance: { background: 'image' } })
    expect(res.status).toBe(400)
    expect((await api().image()).status).toBe(404)
  })

  it('togliere l’immagine in uso riporta lo sfondo predefinito', async () => {
    await api().upload(PNG)
    const res = await api().removeImage()
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ appearance: { background: 'brace' }, backgroundImage: null })
    expect((await api().image()).status).toBe(404)
  })
})

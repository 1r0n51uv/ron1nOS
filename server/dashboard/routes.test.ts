// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createApp } from '../app.ts'
import type { Database } from '../db.ts'
import { testDb } from '../testing/db.ts'
import { fakeQbt } from '../testing/fake-qbt.ts'
import { defaultLayout } from './layout.ts'

let db: Awaited<ReturnType<typeof testDb>>
beforeAll(async () => {
  db = await testDb()
})
afterAll(() => db.drop())
beforeEach(() => db.query('delete from dashboard_layouts'))

function api(database: Database = { db, status: () => 'ok' }) {
  const app = createApp({ qbt: fakeQbt(), database })
  const call = async (method: string, path: string, body?: unknown) => {
    const res = await app.request(`/api/v1/dashboard${path}`, {
      method,
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    return { status: res.status, body: JSON.parse(await res.text()) }
  }
  return {
    get: (path: string) => call('GET', path),
    put: (path: string, body: unknown) => call('PUT', path, body),
    delete: (path: string) => call('DELETE', path),
  }
}

const moved = {
  header: 'line',
  items: [
    { id: 'server.summary', x: 0, y: 0, w: 10, h: 8 },
    { id: 'notes.summary', x: 16, y: 12, w: 8, h: 6 },
  ],
}

describe('rotte del layout (DASH-007)', () => {
  it('senza layout salvato restituisce quello predefinito', async () => {
    const res = await api().get('/layouts/desktop')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      device: 'desktop',
      ...defaultLayout('desktop'),
      updatedAt: null,
      stored: true,
    })
  })

  it('salva e rilegge un layout per dispositivo', async () => {
    const saved = await api().put('/layouts/desktop', moved)
    expect(saved.status).toBe(200)
    expect(saved.body).toMatchObject({ device: 'desktop', ...moved, stored: true })
    expect(saved.body.updatedAt).toEqual(expect.any(String))
    expect((await api().get('/layouts/desktop')).body).toMatchObject(moved)
    // L'iPhone ha il suo, ancora quello predefinito.
    expect((await api().get('/layouts/iphone')).body.updatedAt).toBeNull()
  })

  it('un nuovo salvataggio sostituisce il precedente', async () => {
    await api().put('/layouts/desktop', moved)
    await api().put('/layouts/desktop', { header: 'hidden', items: [] })
    expect((await api().get('/layouts/desktop')).body).toMatchObject({ header: 'hidden', items: [] })
  })

  it('rifiuta con 422 un layout che non rispetta il catalogo', async () => {
    const res = await api().put('/layouts/desktop', {
      header: 'full',
      items: [{ id: 'server.nope', x: 0, y: 0, w: 8, h: 8 }],
    })
    expect(res).toEqual({
      status: 422,
      body: { error: 'invalid_layout', message: 'Widget sconosciuto: server.nope' },
    })
  })

  it('rifiuta con 400 forma o dispositivo sbagliati', async () => {
    expect((await api().put('/layouts/desktop', { header: 'big', items: [] })).status).toBe(400)
    expect((await api().get('/layouts/watch')).status).toBe(400)
  })

  it('senza database legge il predefinito con stored false e non salva', async () => {
    const offline = api({ status: () => 'disabled' })
    const res = await offline.get('/layouts/desktop')
    expect(res.body).toMatchObject({ ...defaultLayout('desktop'), stored: false })
    expect((await offline.put('/layouts/desktop', moved)).status).toBe(503)
    expect((await offline.delete('/layouts/desktop')).status).toBe(503)
  })
})

describe('ripristino del layout (DASH-008)', () => {
  it('cancella il layout del dispositivo, opzioni comprese, e restituisce il predefinito', async () => {
    await api().put('/layouts/desktop', {
      header: 'hidden',
      items: [{ id: 'downloads.summary', x: 0, y: 0, w: 8, h: 8, options: { limit: 1 } }],
    })
    const phone = { header: 'line', items: [{ id: 'server.metric', x: 0, y: 0, w: 2, h: 2 }] }
    await api().put('/layouts/iphone', phone)
    const res = await api().delete('/layouts/desktop')
    expect(res).toEqual({
      status: 200,
      body: { device: 'desktop', ...defaultLayout('desktop'), updatedAt: null, stored: true },
    })
    expect((await api().get('/layouts/desktop')).body.updatedAt).toBeNull()
    // L'iPhone tiene il suo.
    expect((await api().get('/layouts/iphone')).body).toMatchObject(phone)
  })
})

describe('griglia dell’iPhone (DASH-010)', () => {
  it('salva un layout sulla griglia di 4 colonne e rifiuta quello del desktop', async () => {
    const phone = {
      header: 'full',
      items: [
        { id: 'server.metric', x: 0, y: 0, w: 2, h: 2, options: { metric: 'ram' } },
        { id: 'downloads.speed', x: 2, y: 0, w: 2, h: 2 },
      ],
    }
    expect((await api().put('/layouts/iphone', phone)).status).toBe(200)
    expect((await api().get('/layouts/iphone')).body).toMatchObject(phone)
    const res = await api().put('/layouts/iphone', moved)
    expect(res.status).toBe(422)
    expect(res.body.error).toBe('invalid_layout')
  })

  it('converte alla lettura un layout iPhone salvato prima di DASH-010', async () => {
    await db.query(`insert into dashboard_layouts (device, layout) values ('iphone', $1)`, [
      JSON.stringify(moved),
    ])
    const res = await api().get('/layouts/iphone')
    expect(res.body).toMatchObject({
      header: 'line',
      items: [{ id: 'server.summary', x: 0, y: 0, w: 4, h: 2 }],
    })
  })

  it('pubblica il catalogo con le misure iPhone', async () => {
    const res = await api().get('/catalog')
    expect(res.status).toBe(200)
    expect(res.body.grids.iphone).toEqual({
      columns: 4,
      sizes: { small: { w: 2, h: 2 }, medium: { w: 4, h: 2 }, large: { w: 4, h: 4 } },
    })
    const metric = res.body.widgets.find((w: { id: string }) => w.id === 'server.metric')
    expect(metric).toMatchObject({ iphone: ['small', 'medium'], variants: ['detailed', 'compact'] })
  })
})

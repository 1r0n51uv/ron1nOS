import { expect, test } from '@playwright/test'

// Il backend vero (dist-server) contro il qBittorrent finto di e2e/fake-qbittorrent.ts.
const fake = 'http://localhost:18080'

test.afterEach(async ({ request }) => {
  await request.post(`${fake}/__fake/reset`)
})

test('health del backend', async ({ request }) => {
  const res = await request.get('/api/v1/health')
  expect(res.ok()).toBe(true)
  expect(await res.json()).toEqual({ ok: true })
})

test('GET /api/v1/downloads legge da qBittorrent, ordinato', async ({ request }) => {
  const res = await request.get('/api/v1/downloads')
  expect(res.ok()).toBe(true)
  const body = await res.json()
  expect(body.downloadSpeed).toBe(12_100_000)
  expect(body.torrents.map((t: { hash: string }) => t.hash)).toEqual(['a1', 'b2', 'c3', 'd4'])
  expect(body.torrents[2]).toMatchObject({ state: 'queued', etaSeconds: null })
  expect(JSON.stringify(body)).not.toMatch(/password|SID/i)
})

test('qBittorrent spento risponde 503, poi il backend riprende da solo', async ({ request }) => {
  await request.post(`${fake}/__fake/state`, { data: { online: false } })
  const down = await request.get('/api/v1/downloads')
  expect(down.status()).toBe(503)
  expect(await down.json()).toMatchObject({ error: 'qbittorrent_unreachable' })

  await request.post(`${fake}/__fake/state`, { data: { online: true } })
  expect((await request.get('/api/v1/downloads')).ok()).toBe(true)
})

test('credenziali rifiutate rispondono 502', async ({ request }) => {
  await request.post(`${fake}/__fake/state`, { data: { password: 'cambiata' } })
  const res = await request.get('/api/v1/downloads')
  expect(res.status()).toBe(502)
  expect(await res.json()).toMatchObject({ error: 'qbittorrent_auth' })
})

test('rotta API sconosciuta: 404 JSON, non la pagina', async ({ request }) => {
  const res = await request.get('/api/v1/nulla')
  expect(res.status()).toBe(404)
  expect(await res.json()).toMatchObject({ error: 'not_found' })
})

test('il backend serve la SPA anche sui percorsi interni', async ({ request }) => {
  const res = await request.get('/pasti')
  expect(res.ok()).toBe(true)
  expect(await res.text()).toContain('<div id="root">')
})

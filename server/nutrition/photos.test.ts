// @vitest-environment node
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { testDb } from '../testing/db.ts'
import { nutritionApp, resetNutrition, seedFood } from '../testing/nutrition.ts'
import type { PhotoGenerator } from './photos.ts'
import { createPhotoGenerator, PhotoError, photoPrompt } from './photos.ts'

let db: Awaited<ReturnType<typeof testDb>>
let dir: string
beforeAll(async () => {
  db = await testDb()
})
afterAll(() => db.drop())
beforeEach(async () => {
  await resetNutrition(db)
  dir = await mkdtemp(join(tmpdir(), 'foto-'))
})
afterEach(async () => {
  vi.unstubAllGlobals()
  await rm(dir, { recursive: true, force: true })
})

async function recipe() {
  const pollo = await seedFood(db, { name: 'Petto di pollo', kcal: 110, protein: 23, carbs: 0, fat: 1.2 })
  const api = nutritionApp(db, {})
  const res = await api.post('/recipes', {
    name: 'Pollo alla griglia',
    steps: ['Griglia il pollo.'],
    items: [{ foodId: pollo, grams: 150 }],
  })
  return res.body.id as string
}

// Aspetta che il lavoro in background finisca.
async function settled(api: ReturnType<typeof nutritionApp>, id: string) {
  for (let i = 0; i < 50; i++) {
    const r = (await api.get(`/recipes/${id}`)).body
    if (r.photo?.state !== 'generating') return r
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  throw new Error('il lavoro non finisce')
}

describe('foto generata di una ricetta (NUT-036)', () => {
  it('parte, torna subito e a lavoro finito la ricetta ha la foto', async () => {
    const id = await recipe()
    const photos: PhotoGenerator = {
      dir,
      generate: async (r) => writeFile(join(dir, `${r.id}.png`), 'PNG'),
    }
    const api = nutritionApp(db, { photos })
    const started = await api.post(`/recipes/${id}/photo/generate`)
    expect(started.status).toBe(202)
    expect(started.body.photo).toEqual({ state: 'generating', error: null })

    const done = await settled(api, id)
    expect(done.photo).toBeNull()
    expect(done.imageUrl).toMatch(new RegExp(`^/api/v1/nutrition/recipes/${id}/photo\\?v=\\d+$`))

    const file = await api.app.request(`/api/v1/nutrition/recipes/${id}/photo`)
    expect(file.status).toBe(200)
    expect(file.headers.get('content-type')).toBe('image/png')
    expect(await file.text()).toBe('PNG')
  })

  it('un errore del dojo resta nella ricetta, e si può riprovare', async () => {
    const id = await recipe()
    const photos: PhotoGenerator = {
      dir,
      generate: async () => {
        throw new PhotoError('Il dojo non risponde')
      },
    }
    const api = nutritionApp(db, { photos })
    await api.post(`/recipes/${id}/photo/generate`)
    expect((await settled(api, id)).photo).toEqual({ state: 'failed', error: 'Il dojo non risponde' })
    expect((await api.post(`/recipes/${id}/photo/generate`)).status).toBe(202)
  })

  it('senza il file dopo la risposta la ricetta resta senza foto', async () => {
    const id = await recipe()
    const api = nutritionApp(db, { photos: { dir, generate: async () => undefined } })
    await api.post(`/recipes/${id}/photo/generate`)
    const done = await settled(api, id)
    expect(done.photo).toEqual({ state: 'failed', error: 'Image Chef non ha salvato la foto' })
    expect(done.imageUrl).toBeNull()
  })

  it('un solo lavoro alla volta per ricetta', async () => {
    const id = await recipe()
    let release: () => void = () => undefined
    const photos: PhotoGenerator = {
      dir,
      generate: () => new Promise<void>((resolve) => (release = resolve)),
    }
    const api = nutritionApp(db, { photos })
    expect((await api.post(`/recipes/${id}/photo/generate`)).status).toBe(202)
    const again = await api.post(`/recipes/${id}/photo/generate`)
    expect(again.status).toBe(409)
    expect(again.body.error).toBe('photo_in_progress')
    release()
    await settled(api, id)
  })

  it('un lavoro rimasto a metà da troppo tempo si può rifare', async () => {
    const id = await recipe()
    await db.query(
      `update recipes set photo_state = 'generating', photo_started_at = now() - interval '1 hour' where id = $1`,
      [id],
    )
    const api = nutritionApp(db, { photos: { dir, generate: async () => undefined } })
    expect((await api.post(`/recipes/${id}/photo/generate`)).status).toBe(202)
    await settled(api, id)
  })

  it('senza dojo configurato risponde 503, e la foto manca (404)', async () => {
    const id = await recipe()
    const api = nutritionApp(db, {})
    const res = await api.post(`/recipes/${id}/photo/generate`)
    expect(res.status).toBe(503)
    expect(res.body.error).toBe('photos_not_configured')
    expect((await api.get(`/recipes/${id}/photo`)).status).toBe(404)
  })

  it('ricetta sconosciuta: 404', async () => {
    const api = nutritionApp(db, { photos: { dir, generate: async () => undefined } })
    const res = await api.post('/recipes/00000000-0000-4000-8000-000000000000/photo/generate')
    expect(res.status).toBe(404)
  })
})

describe('richiesta a image-chef', () => {
  const sample = {
    id: 'r1',
    name: 'Pollo',
    steps: ['Griglia.'],
    items: [{ name: 'Petto di pollo' }],
  } as unknown as Parameters<typeof photoPrompt>[0]

  it('mette i dati nel blocco RICETTA e il percorso fuori', () => {
    expect(photoPrompt(sample, '/opt/data/work/foto-ricette/r1.png')).toBe(
      [
        'RICETTA',
        'id: r1',
        'nome: Pollo',
        'ingredienti: Petto di pollo',
        'procedimento:',
        '1. Griglia.',
        'FINE RICETTA',
        'FILE: /opt/data/work/foto-ricette/r1.png',
      ].join('\n'),
    )
  })

  it('chiama il profile image-chef con la chiave del gateway', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ choices: [{ message: { content: 'FATTO /x.png' } }] }), {
          status: 200,
        }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const gen = createPhotoGenerator({ url: 'http://dojo-gateway:8642/', key: 'k', dir, agentDir: '/a' })
    await gen.generate(sample)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('http://dojo-gateway:8642/p/image-chef/v1/chat/completions')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer k')
    expect(JSON.parse(init.body as string).messages[0].content).toContain('FILE: /a/r1.png')
  })

  it.each([['ERRORE login ChatGPT scaduto', 'login ChatGPT scaduto']])(
    '%s diventa il motivo',
    async (answer, reason) => {
      vi.stubGlobal(
        'fetch',
        async () =>
          new Response(JSON.stringify({ choices: [{ message: { content: answer } }] }), { status: 200 }),
      )
      const gen = createPhotoGenerator({ url: 'http://x', key: 'k', dir, agentDir: '/a' })
      await expect(gen.generate(sample)).rejects.toThrow(reason)
    },
  )

  it('dojo spento o errore HTTP: motivo leggibile', async () => {
    const gen = createPhotoGenerator({ url: 'http://x', key: 'k', dir, agentDir: '/a' })
    vi.stubGlobal('fetch', async () => Promise.reject(new TypeError('fetch failed')))
    await expect(gen.generate(sample)).rejects.toThrow('Il dojo non risponde')
    vi.stubGlobal('fetch', async () => new Response('no', { status: 401 }))
    await expect(gen.generate(sample)).rejects.toThrow('Il dojo ha risposto 401')
  })
})

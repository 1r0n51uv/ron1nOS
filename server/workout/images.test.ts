// @vitest-environment node
// Rotte delle immagini degli esercizi (GYM-014) su un Postgres vero.
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { createApp } from '../app.ts'
import { testDb } from '../testing/db.ts'
import { createFakeExercises, FAKE_JPEG } from '../testing/fake-exercises.ts'
import { fakeQbt } from '../testing/fake-qbt.ts'
import { createCatalog } from './catalog.ts'
import { groupFromMuscles } from './groups.ts'
import { exerciseImages } from './images.ts'

let db: Awaited<ReturnType<typeof testDb>>
let dir: string
let fake: ReturnType<typeof createFakeExercises>
let catalog: ReturnType<typeof createCatalog>
beforeAll(async () => {
  db = await testDb()
  dir = await mkdtemp(join(tmpdir(), 'catalog-'))
})
afterAll(async () => {
  await db.drop()
  await rm(dir, { recursive: true, force: true })
})
beforeEach(async () => {
  await db.query('truncate workout_exercises')
  fake = createFakeExercises()
  catalog = createCatalog({ dir, url: 'http://fake/catalog', fetchImpl: fake.fetch })
})

const app = (database: 'ok' | 'disabled' = 'ok') =>
  createApp({
    qbt: fakeQbt(),
    database: database === 'ok' ? { db, status: () => 'ok' } : { status: () => 'disabled' },
    workout: { catalog },
  })

async function call(method: string, path: string, body?: unknown, database: 'ok' | 'disabled' = 'ok') {
  const res = await app(database).request(`/api/v1/workout${path}`, {
    method,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const json = res.headers.get('content-type')?.includes('json') ? await res.json() : null
  return { status: res.status, body: json as { image?: unknown } | null }
}

describe('GET /catalog', () => {
  it('cerca nel catalogo, con l indirizzo della foto', async () => {
    const { status, body } = await call('GET', '/catalog?q=squat')
    expect(status).toBe(200)
    expect(body).toEqual({
      exercises: [
        {
          id: 'Barbell_Squat',
          name: 'Barbell Squat',
          primaryMuscles: ['quadriceps'],
          equipment: 'barbell',
          images: 2,
          url: '/api/v1/workout/catalog/images/Barbell_Squat/0.jpg',
        },
      ],
    })
  })

  it('senza catalogo risponde 503', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    fake.setDown(true)
    catalog = createCatalog({ dir: join(dir, 'vuota'), url: 'http://fake/catalog', fetchImpl: fake.fetch })
    expect(await call('GET', '/catalog')).toEqual({
      status: 503,
      body: { error: 'catalog_unavailable', message: 'Catalogo delle immagini non disponibile' },
    })
    vi.restoreAllMocks()
  })
})

describe('GET /catalog/images', () => {
  it('serve la foto anche con il database spento', async () => {
    const res = await app('disabled').request('/api/v1/workout/catalog/images/Plank/0.jpg')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/jpeg')
    expect(res.headers.get('cache-control')).toContain('immutable')
    expect(Buffer.from(await res.arrayBuffer())).toEqual(FAKE_JPEG)
  })

  it('404 per id o file sconosciuti', async () => {
    for (const path of [
      '/catalog/images/Nope/0.jpg',
      '/catalog/images/Plank/5.jpg',
      '/catalog/images/Plank/0.png',
    ]) {
      expect((await app().request(`/api/v1/workout${path}`)).status).toBe(404)
    }
  })
})

describe('PUT /exercises/{name}/image', () => {
  it('la scelta a mano vale per il nome normalizzato e prevale sul dizionario', async () => {
    const { status, body } = await call('PUT', `/exercises/${encodeURIComponent(' Panca  PIANA')}/image`, {
      catalogId: 'Dumbbell_Flyes',
    })
    expect(status).toBe(200)
    expect(body).toEqual({
      name: 'panca piana',
      image: {
        catalogId: 'Dumbbell_Flyes',
        source: 'manual',
        url: '/api/v1/workout/catalog/images/Dumbbell_Flyes/0.jpg',
      },
      // Il gruppo proposto dai muscoli del catalogo (GYM-011).
      group: 'petto',
    })
    // null torna al dizionario.
    const reset = await call('PUT', '/exercises/panca%20piana/image', { catalogId: null })
    expect(reset.body?.image).toMatchObject({
      catalogId: 'Barbell_Bench_Press_-_Medium_Grip',
      source: 'dictionary',
    })
  })

  it('il gruppo si propone solo se manca', async () => {
    await call('PUT', '/exercises/curl%20strano/group', { group: 'bicipiti' })
    const kept = await call('PUT', '/exercises/curl%20strano/image', { catalogId: 'Face_Pull' })
    expect((kept.body as { group?: unknown }).group).toBe('bicipiti')
    const proposed = await call('PUT', '/exercises/plank%20laterale/image', { catalogId: 'Plank' })
    expect((proposed.body as { group?: unknown }).group).toBe('addome')
  })

  it('un id che non è nel catalogo risponde 404, un corpo sbagliato 400', async () => {
    expect((await call('PUT', '/exercises/squat/image', { catalogId: 'Nope' })).status).toBe(404)
    expect((await call('PUT', '/exercises/squat/image', { id: 'Plank' })).status).toBe(400)
  })
})

describe('PUT /exercises/{name}/group', () => {
  it('assegna e toglie il gruppo per il nome normalizzato', async () => {
    expect(await call('PUT', '/exercises/Panca%20%20PIANA/group', { group: 'petto' })).toEqual({
      status: 200,
      body: { name: 'panca piana', group: 'petto' },
    })
    const { rows } = await db.query(
      `select muscle_group from workout_exercises where exercise_key = 'panca piana'`,
    )
    expect(rows).toEqual([{ muscle_group: 'petto' }])
    expect((await call('PUT', '/exercises/panca%20piana/group', { group: null })).body).toEqual({
      name: 'panca piana',
      group: null,
    })
  })

  it('un gruppo fuori elenco risponde 400', async () => {
    expect((await call('PUT', '/exercises/squat/group', { group: 'quadricipiti' })).status).toBe(400)
  })
})

describe('groupFromMuscles', () => {
  it('il primo muscolo che ha un gruppo', () => {
    expect(groupFromMuscles(['quadriceps', 'glutes'])).toBe('gambe')
    expect(groupFromMuscles(['Lower Back'])).toBe('schiena')
    expect(groupFromMuscles(['mistero', 'triceps'])).toBe('tricipiti')
    expect(groupFromMuscles([])).toBeNull()
  })
})

describe('exerciseImages', () => {
  it('scelta a mano, poi dizionario, poi stesso nome inglese, altrimenti nessuna', async () => {
    await catalog.ready()
    await db.query(
      `insert into workout_exercises (exercise_key, catalog_id) values ('alzate strane', 'Face_Pull')`,
    )
    const images = await exerciseImages(db, catalog, [
      'alzate strane',
      'squat',
      'incline dumbbell press',
      'esercizio mio',
    ])
    expect([...images].map(([k, v]) => [k, v?.catalogId ?? null, v?.source ?? null])).toEqual([
      ['alzate strane', 'Face_Pull', 'manual'],
      ['squat', 'Barbell_Squat', 'dictionary'],
      ['incline dumbbell press', 'Incline_Dumbbell_Press', 'catalog'],
      ['esercizio mio', null, null],
    ])
  })
})

// @vitest-environment node
// Catalogo delle immagini (GYM-014): copia su disco, ricerca, foto.
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createFakeExercises, FAKE_JPEG } from '../testing/fake-exercises.ts'
import ids from '../testing/free-exercise-db-ids.json' with { type: 'json' }
import { createCatalog, toEntries } from './catalog.ts'
import { DICTIONARY } from './dictionary.ts'

let dir: string
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'catalog-'))
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(async () => {
  vi.restoreAllMocks()
  await rm(dir, { recursive: true, force: true })
})

const URL = 'http://fake/catalog'

describe('createCatalog', () => {
  it('scarica l elenco una volta e poi lo legge dal disco', async () => {
    const fake = createFakeExercises()
    const catalog = createCatalog({ dir, url: URL, fetchImpl: fake.fetch })
    expect(await catalog.ready()).toBe(true)
    expect(fake.requests).toEqual(['/catalog/dist/exercises.json'])
    expect(JSON.parse(await readFile(join(dir, 'source.json'), 'utf8')).url).toBe(URL)

    const again = createCatalog({ dir, url: URL, fetchImpl: fake.fetch })
    expect(await again.ready()).toBe(true)
    expect(fake.requests).toHaveLength(1)
    expect(again.get('Plank')).toEqual({
      id: 'Plank',
      name: 'Plank',
      primaryMuscles: ['abdominals'],
      equipment: 'body only',
      images: 2,
    })
  })

  it('con un altro indirizzo riscarica l elenco', async () => {
    const fake = createFakeExercises()
    await createCatalog({ dir, url: URL, fetchImpl: fake.fetch }).ready()
    await createCatalog({ dir, url: `${URL}-v2`, fetchImpl: fake.fetch }).ready()
    expect(fake.requests).toEqual(['/catalog/dist/exercises.json', '/catalog-v2/dist/exercises.json'])
  })

  it('senza rete non è pronto e riprova solo dopo un minuto', async () => {
    const fake = createFakeExercises()
    fake.setDown(true)
    let now = 0
    const catalog = createCatalog({ dir, url: URL, fetchImpl: fake.fetch, now: () => now })
    expect(await catalog.ready()).toBe(false)
    expect(await catalog.ready()).toBe(false)
    expect(fake.requests).toHaveLength(1)
    fake.setDown(false)
    now = 61_000
    expect(await catalog.ready()).toBe(true)
  })

  it('cerca per parole del nome inglese', async () => {
    const catalog = createCatalog({ dir, url: URL, fetchImpl: createFakeExercises().fetch })
    await catalog.ready()
    expect(catalog.search('dumb').map((e) => e.id)).toEqual(['Dumbbell_Flyes', 'Incline_Dumbbell_Press'])
    expect(catalog.search('incline press').map((e) => e.id)).toEqual(['Incline_Dumbbell_Press'])
    expect(catalog.search('')).toHaveLength(6)
    expect(catalog.byName('barbell squat')?.id).toBe('Barbell_Squat')
  })

  it('scarica una foto alla prima richiesta e poi la serve dal disco', async () => {
    const fake = createFakeExercises()
    const catalog = createCatalog({ dir, url: URL, fetchImpl: fake.fetch })
    await catalog.ready()
    expect(await catalog.image('Plank', 1)).toEqual(FAKE_JPEG)
    expect(await catalog.image('Plank', 1)).toEqual(FAKE_JPEG)
    expect(fake.requests.filter((p) => p.endsWith('.jpg'))).toEqual(['/catalog/exercises/Plank/1.jpg'])
    expect(await readFile(join(dir, 'images', 'Plank', '1.jpg'))).toEqual(FAKE_JPEG)
  })

  it('id sconosciuti e numeri fuori elenco non diventano richieste', async () => {
    const fake = createFakeExercises()
    const catalog = createCatalog({ dir, url: URL, fetchImpl: fake.fetch })
    await catalog.ready()
    expect(await catalog.image('../../etc', 0)).toBeNull()
    expect(await catalog.image('Plank', 2)).toBeNull()
    expect(fake.requests).toHaveLength(1)
  })
})

describe('toEntries', () => {
  it('scarta voci senza id valido, nome o foto', () => {
    expect(
      toEntries([
        { id: '../x', name: 'X', images: ['a'] },
        { id: 'A..B', name: 'X', images: ['a'] },
        { id: 'Ok', name: 'Ok', images: [] },
        { id: 'Ok', images: ['a'] },
        { id: 'Good_One', name: 'Good One', images: ['a', 'b'], primaryMuscles: ['chest', 3] },
      ]),
    ).toEqual([{ id: 'Good_One', name: 'Good One', primaryMuscles: ['chest'], equipment: null, images: 2 }])
    expect(toEntries({})).toEqual([])
  })
})

describe('DICTIONARY', () => {
  it('ogni abbinamento esiste nel catalogo vero', () => {
    const known = new Set(ids)
    expect([...DICTIONARY.values()].filter((id) => !known.has(id))).toEqual([])
  })

  it('copre i nomi italiani più comuni', () => {
    for (const name of [
      'panca piana',
      'squat',
      'stacco',
      'rematore',
      'military press',
      'lat machine',
      'plank',
    ]) {
      expect(DICTIONARY.has(name)).toBe(true)
    }
  })
})

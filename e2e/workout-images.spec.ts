import { expect, test } from '@playwright/test'

import { resetNutrition, sql } from './db.ts'

test.beforeEach(async () => {
  await resetNutrition()
})

const CSV = 'Date;Routine;Exercise;Set;Weight;Reps/Time\n2026-10-20;Push;Croci ai cavi alti;1;15;12'

test('una foto del catalogo si sceglie, si serve dal backend e resta dopo un re-import (GYM-014)', async ({
  page,
}) => {
  const all = await (await page.request.get('/api/v1/workout/catalog?q=dumbbell')).json()
  expect(all.exercises.map((e: { id: string }) => e.id)).toEqual(['Dumbbell_Flyes', 'Incline_Dumbbell_Press'])

  const photo = await page.request.get(all.exercises[0].url)
  expect(photo.headers()['content-type']).toBe('image/jpeg')
  expect((await photo.body()).subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]))

  const multipart = { file: { name: 'liftin.csv', mimeType: 'text/csv', buffer: Buffer.from(CSV) } }
  await page.request.post('/api/v1/workout/import', { multipart })
  const chosen = await page.request.put('/api/v1/workout/exercises/Croci%20ai%20cavi%20alti/image', {
    data: { catalogId: 'Dumbbell_Flyes' },
  })
  expect((await chosen.json()).image).toMatchObject({ catalogId: 'Dumbbell_Flyes', source: 'manual' })

  await page.request.post('/api/v1/workout/import', { multipart })
  expect(await sql('select exercise_key, catalog_id from workout_exercises')).toEqual([
    { exercise_key: 'croci ai cavi alti', catalog_id: 'Dumbbell_Flyes' },
  ])
})

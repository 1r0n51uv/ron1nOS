import { expect, test } from '@playwright/test'

import { resetNutrition } from './db.ts'

// Il backend vero contro OpenFoodFacts e USDA finti (e2e/fake-foods.ts).
const fake = 'http://localhost:18083'

test.beforeEach(async ({ request }) => {
  await resetNutrition()
  await request.post(`${fake}/__fake/reset`)
})

test('la ricerca unisce OpenFoodFacts e USDA, Solo Italia di default (NUT-004)', async ({ request }) => {
  const res = await request.get('/api/v1/nutrition/foods/search?q=yogurt')
  expect(res.ok()).toBe(true)
  const body = await res.json()
  expect(body.unavailable).toEqual([])
  const names = body.results.map((r: { name: string }) => r.name)
  expect(names).toContain('Yogurt greco bianco 2%')
  expect(names).toContain('Yogurt, greek, plain, nonfat')
  expect(names).not.toContain('Griechischer Joghurt')
  expect(body.results[0]).toMatchObject({ source: 'openfoodfacts', id: null })
})

test('con OpenFoodFacts giù restano gli altri risultati', async ({ request }) => {
  await request.post(`${fake}/__fake/state`, { data: { off: false } })
  const body = await (await request.get('/api/v1/nutrition/foods/search?q=yogurt')).json()
  expect(body.unavailable).toEqual(['openfoodfacts'])
  expect(body.results.map((r: { source: string }) => r.source)).toEqual(['usda'])
})

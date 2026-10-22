import { expect, test } from '@playwright/test'

import { resetNutrition, todayRome } from './db.ts'

// Il backend vero contro YAZIO finto (e2e/fake-yazio.ts).
const fake = 'http://localhost:18084'

test.beforeEach(async ({ request }) => {
  await resetNutrition()
  await request.post(`${fake}/__fake/reset`)
})

test('quello che si registra in YAZIO compare in ron1nOS e sparisce se lo si cancella lì (NUT-022)', async ({
  page,
  request,
}) => {
  const day = todayRome()
  const entry = {
    id: '00000000-0000-4000-8000-000000000001',
    date: `${day} 16:30:00`,
    daytime: 'snack',
    product_id: 'p-yogurt',
    amount: 170,
    serving: null,
    serving_quantity: null,
  }
  await request.post(`${fake}/__fake/state`, { data: { consumed: [entry], water: { [day]: 1250 } } })
  expect((await page.request.post('/api/v1/nutrition/yazio/sync')).ok()).toBe(true)

  await page.goto('/pasti')
  const snack = page.getByRole('article', { name: 'Merenda' })
  await expect(snack.getByText(/Yogurt greco bianco 2%.*· da YAZIO/)).toBeVisible()
  await expect(page.getByRole('region', { name: 'Acqua' }).getByText(/^1\.?250$/)).toBeVisible()

  await request.post(`${fake}/__fake/state`, { data: { consumed: [] } })
  expect((await page.request.post('/api/v1/nutrition/yazio/sync')).ok()).toBe(true)
  await page.reload()
  await expect(page.getByRole('article', { name: 'Merenda' }).getByText('Niente registrato.')).toBeVisible()
})

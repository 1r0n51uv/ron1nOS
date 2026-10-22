import { expect, test } from '@playwright/test'

import { resetNutrition } from './db.ts'

// Il backend vero contro YAZIO e OpenFoodFacts finti.
const yazio = 'http://localhost:18084'
const foods = 'http://localhost:18083'

test.beforeEach(async ({ request }) => {
  await resetNutrition()
  await request.post(`${yazio}/__fake/reset`)
  await request.post(`${foods}/__fake/reset`)
})

test('con YAZIO collegato la ricerca trova i prodotti YAZIO e il pasto tiene il product_id (NUT-021)', async ({
  page,
}) => {
  expect((await page.request.post('/api/v1/nutrition/yazio/sync')).ok()).toBe(true)

  await page.goto('/pasti')
  await page.getByRole('button', { name: 'Registra in Pranzo' }).click()
  const dialog = page.getByRole('dialog', { name: 'Cosa hai mangiato' })
  await dialog.getByLabel('Cerca un alimento').fill('grissini')
  const result = dialog.getByRole('button', { name: /Grissini classici/ })
  await expect(result).toContainText('yazio')
  await result.click()
  await dialog.getByLabel('Quantità in grammi').fill('20')
  await dialog.getByRole('button', { name: 'Aggiungi' }).click()
  await dialog.getByRole('button', { name: 'Registra' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('article', { name: 'Pranzo' }).getByText(/Grissini classici/)).toBeVisible()

  const search = await (await page.request.get('/api/v1/nutrition/foods/search?q=grissini')).json()
  expect(search.results[0]).toMatchObject({
    name: 'Grissini classici',
    source: 'yazio',
    yazioProductId: 'p-grissini',
    id: expect.any(String),
  })
})

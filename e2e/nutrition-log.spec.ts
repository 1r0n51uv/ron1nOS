import { expect, test } from '@playwright/test'

import { resetNutrition } from './db.ts'

// Il backend vero contro OpenFoodFacts e USDA finti (e2e/fake-foods.ts).
const fake = 'http://localhost:18083'

test.beforeEach(async ({ request }) => {
  await resetNutrition()
  await request.post(`${fake}/__fake/reset`)
})

test('registrare un pasto cercando un alimento (NUT-003)', async ({ page }) => {
  await page.goto('/pasti')
  await page.getByRole('button', { name: 'Registra in Pranzo' }).click()
  const dialog = page.getByRole('dialog', { name: 'Cosa hai mangiato' })
  await expect(dialog.getByRole('radio', { name: 'Pranzo' })).toHaveAttribute('aria-checked', 'true')

  await dialog.getByLabel('Cerca un alimento').fill('yogurt greco')
  await dialog.getByRole('button', { name: /Yogurt greco bianco 2%/ }).click()
  // La porzione del prodotto è la quantità proposta.
  await expect(dialog.getByLabel('Quantità in grammi')).toHaveValue('170')
  await dialog.getByLabel('Quantità in grammi').fill('200')
  await expect(dialog.getByText('146 kcal · P 20 · C 8 · G 4')).toBeVisible()
  await dialog.getByRole('button', { name: 'Aggiungi' }).click()
  await expect(
    dialog.getByRole('list', { name: 'Nel pasto' }).getByText('Yogurt greco bianco 2%'),
  ).toBeVisible()

  await dialog.getByRole('button', { name: 'Registra' }).click()
  await expect(dialog).toBeHidden()

  const lunch = page.getByRole('article', { name: 'Pranzo' })
  await expect(lunch.getByText('mangiato')).toBeVisible()
  await expect(lunch.getByText('Yogurt greco bianco 2% (Fage)')).toBeVisible()
  await expect(lunch.getByText('146 kcal').first()).toBeVisible()

  // L'alimento usato ora sta nel catalogo: la ricerca lo trova come proprio.
  const search = await (await page.request.get('/api/v1/nutrition/foods/search?q=fage')).json()
  expect(search.results[0]).toMatchObject({ name: 'Yogurt greco bianco 2%', id: expect.any(String) })
})

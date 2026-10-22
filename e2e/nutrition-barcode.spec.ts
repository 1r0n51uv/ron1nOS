import { expect, test } from '@playwright/test'

import { resetNutrition } from './db.ts'

// Il backend vero contro OpenFoodFacts finto (e2e/fake-foods.ts).
const fake = 'http://localhost:18083'

test.beforeEach(async ({ request }) => {
  await resetNutrition()
  await request.post(`${fake}/__fake/reset`)
})

test('un codice a barre trovato su OpenFoodFacts si registra (NUT-005)', async ({ page }) => {
  await page.goto('/pasti')
  await page.getByRole('button', { name: 'Registra in Colazione' }).click()
  const dialog = page.getByRole('dialog', { name: 'Cosa hai mangiato' })
  await dialog.getByRole('tab', { name: 'Codice a barre' }).click()
  await dialog.getByRole('textbox', { name: 'Codice a barre' }).fill('5201054017111')
  await dialog.getByRole('button', { name: 'Cerca' }).click()
  await expect(dialog.getByRole('group', { name: 'Alimento scelto' })).toContainText('Yogurt greco bianco 2%')
  await expect(dialog.getByLabel('Quantità in grammi')).toHaveValue('170')
  await dialog.getByRole('button', { name: 'Aggiungi' }).click()
  await dialog.getByRole('button', { name: 'Registra' }).click()
  await expect(
    page.getByRole('article', { name: 'Colazione' }).getByText('Yogurt greco bianco 2% (Fage)'),
  ).toBeVisible()
})

test('un codice sconosciuto porta a creare l’alimento col codice già scritto', async ({ page, request }) => {
  await page.goto('/pasti')
  await page.getByRole('button', { name: 'Registra in Merenda' }).click()
  const dialog = page.getByRole('dialog', { name: 'Cosa hai mangiato' })
  await dialog.getByRole('tab', { name: 'Codice a barre' }).click()
  await dialog.getByRole('textbox', { name: 'Codice a barre' }).fill('80012345')
  await dialog.getByRole('button', { name: 'Cerca' }).click()
  await dialog.getByRole('button', { name: "Crea l'alimento" }).click()

  const form = dialog.getByRole('form', { name: 'Alimento personale' })
  await expect(form.getByLabel(/^Codice a barre/)).toHaveValue('80012345')
  await form.getByLabel(/^Nome/).fill('Barretta ai cereali')
  for (const [label, value] of [
    ['Calorie', '380'],
    ['Proteine', '8'],
    ['Carboidrati', '60'],
    ['Grassi', '12'],
  ]) {
    await form.getByLabel(new RegExp(`^${label}`)).fill(value)
  }
  await form.getByRole('button', { name: 'Crea e scegli' }).click()
  await expect(dialog.getByRole('group', { name: 'Alimento scelto' })).toContainText('Barretta ai cereali')

  // Ora il codice è nel catalogo.
  const res = await (await request.get('/api/v1/nutrition/foods/barcode/80012345')).json()
  expect(res.food).toMatchObject({ name: 'Barretta ai cereali', source: 'custom' })
})

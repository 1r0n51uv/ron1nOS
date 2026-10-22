import { expect, test } from '@playwright/test'

import { resetNutrition } from './db.ts'

test.beforeEach(() => resetNutrition())

test("l'obiettivo nutrizionale si imposta a mano e resta salvato (NUT-015)", async ({ page }) => {
  await page.goto('/impostazioni')
  const panel = page.getByText('Obiettivo nutrizionale').locator('xpath=ancestor::*[@data-slot="card"]')
  await panel.getByLabel('Calorie').fill('2021')
  await panel.getByLabel('Proteine').fill('126')
  await panel.getByLabel('Carboidrati').fill('227')
  await panel.getByLabel('Grassi').fill('67')
  await panel.getByLabel('Acqua').fill('2500')
  await panel.getByRole('button', { name: 'Salva' }).click()
  await expect(panel.getByRole('button', { name: 'Salva' })).toBeDisabled()

  await page.reload()
  await expect(page.getByLabel('Calorie')).toHaveValue('2021')
  await expect(page.getByLabel('Acqua')).toHaveValue('2500')
  await expect(page.getByText('manuale')).toBeVisible()
})

test('un secondo obiettivo entra nello storico', async ({ page, request }) => {
  await request.post('/api/v1/nutrition/goals', {
    data: { kcal: 1900, protein: 120, carbs: 200, fat: 60, effectiveFrom: '2026-09-01' },
  })
  await page.goto('/impostazioni')
  await page.getByLabel('Calorie').fill('2100')
  await page.getByRole('button', { name: 'Salva' }).click()
  await expect(page.getByText('Storico')).toBeVisible()
  await expect(page.getByText('dal 1 set')).toBeVisible()
  await expect(page.getByText(/^1\.?900 kcal · P 120 · C 200 · G 60 g$/)).toBeVisible()
})

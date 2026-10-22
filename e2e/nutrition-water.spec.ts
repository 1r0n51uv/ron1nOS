import { expect, test } from '@playwright/test'

import { resetNutrition } from './db.ts'

test.beforeEach(async ({ request }) => {
  await resetNutrition()
  await request.post('/api/v1/nutrition/goals', {
    data: { kcal: 2000, protein: 120, carbs: 220, fat: 65, waterMl: 2000, effectiveFrom: '2026-01-01' },
  })
})

test('l’acqua si aggiunge a 250 ml e − annulla l’ultima voce (NUT-012)', async ({ page }) => {
  await page.goto('/pasti')
  const water = page.getByRole('region', { name: 'Acqua' })
  const undo = water.getByRole('button', { name: 'Annulla l’ultima acqua' })
  await expect(undo).toBeDisabled()

  const add = water.getByRole('button', { name: 'Aggiungi 250 ml' })
  await add.click()
  await expect(water.getByRole('progressbar', { name: /^Acqua 250 di 2\.?000 ml$/ })).toBeVisible()
  await add.click()
  await add.click()
  await expect(water.getByRole('progressbar', { name: /^Acqua 750 di 2\.?000 ml$/ })).toBeVisible()

  await undo.click()
  await expect(water.getByRole('progressbar', { name: /^Acqua 500 di 2\.?000 ml$/ })).toBeVisible()

  // Il totale resta dopo aver ricaricato la pagina.
  await page.reload()
  await expect(water.getByRole('progressbar', { name: /^Acqua 500 di 2\.?000 ml$/ })).toBeVisible()
})

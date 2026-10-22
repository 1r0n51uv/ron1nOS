import { expect, test } from '@playwright/test'

import { resetNutrition, seedMeal, todayRome } from './db.ts'

test.beforeEach(async ({ request }) => {
  await resetNutrition()
  await request.post('/api/v1/nutrition/goals', {
    data: { kcal: 2000, protein: 120, carbs: 220, fat: 65, effectiveFrom: '2026-01-01' },
  })
})

test('il widget Nutrizione mostra la giornata di oggi (NUT-001)', async ({ page }) => {
  await seedMeal(todayRome(), 'breakfast', [{ name: 'Yogurt greco 0%', grams: 170, kcal: 99 }])
  await page.goto('/')
  await expect(page.getByRole('img', { name: /^99 kcal su 2\.?000$/ })).toBeVisible()
  await expect(page.getByText('Prossimo pasto')).toBeVisible()
  await expect(page.getByText('Niente pianificato')).toBeVisible()
  await expect(page.getByLabel('Proteine 0 / 120 g')).toBeVisible()

  await page
    .getByRole('link', { name: /Dettagli/ })
    .first()
    .click()
  await expect(page).toHaveURL(/\/pasti$/)
  await expect(page.getByRole('heading', { name: 'Pasti', level: 1 })).toBeVisible()
})

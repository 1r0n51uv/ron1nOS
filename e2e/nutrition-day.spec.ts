import { expect, test } from '@playwright/test'

import { dayFromToday, resetNutrition, seedMeal, todayRome } from './db.ts'

test.beforeEach(async ({ request }) => {
  await resetNutrition()
  await request.post('/api/v1/nutrition/goals', {
    data: { kcal: 2000, protein: 120, carbs: 220, fat: 65, effectiveFrom: '2026-01-01' },
  })
})

test('la pagina Pasti mostra i 5 pasti di oggi e il riepilogo (NUT-002)', async ({ page }) => {
  await seedMeal(todayRome(), 'breakfast', [
    { name: 'Yogurt greco 0%', grams: 170, kcal: 99 },
    { name: "Fiocchi d'avena", grams: 50, kcal: 186 },
  ])
  await page.goto('/pasti')
  await expect(page.getByRole('heading', { name: 'Pasti', level: 1 })).toBeVisible()
  for (const slot of ['Colazione', 'Spuntino', 'Pranzo', 'Merenda', 'Cena']) {
    await expect(page.getByRole('article', { name: slot })).toBeVisible()
  }
  const breakfast = page.getByRole('article', { name: 'Colazione' })
  await expect(breakfast.getByText('mangiato')).toBeVisible()
  await expect(breakfast.getByText('285 kcal')).toBeVisible()
  await expect(page.getByRole('article', { name: 'Cena' }).getByText('Niente registrato.')).toBeVisible()
  await expect(page.getByRole('img', { name: /^285 kcal su 2\.?000$/ })).toBeVisible()
})

test('scegliere un altro giorno mostra pasti e totali di quel giorno', async ({ page }) => {
  await seedMeal(dayFromToday(-2), 'dinner', [{ name: 'Salmone e patate', grams: 400, kcal: 505 }])
  await page.goto('/pasti')
  await expect(page.getByRole('img', { name: /^0 kcal su 2\.?000$/ })).toBeVisible()

  const strip = page.getByRole('navigation', { name: 'Giorni' })
  await strip.locator(`a[href="/pasti?giorno=${dayFromToday(-2)}"]`).click()
  await expect(page).toHaveURL(new RegExp(`giorno=${dayFromToday(-2)}`))
  await expect(page.getByRole('article', { name: 'Cena' }).getByText('Salmone e patate')).toBeVisible()
  await expect(page.getByRole('img', { name: /^505 kcal su 2\.?000$/ })).toBeVisible()

  await strip.getByRole('link', { name: 'Oggi' }).click()
  await expect(page.getByRole('img', { name: /^0 kcal su 2\.?000$/ })).toBeVisible()
})

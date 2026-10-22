import { expect, test } from '@playwright/test'

import { dayFromToday, resetNutrition, seedMeal, sql } from './db.ts'

test.beforeEach(async () => {
  await resetNutrition()
})

test('l’andamento mostra media, aderenza e peso, su 30 e 90 giorni (NUT-017)', async ({ page }) => {
  await sql(
    `insert into nutrition_goals (source, calories_target, protein_g_target, carbs_g_target, fat_g_target,
       effective_from) values ('manual', 2000, 120, 220, 65, $1)`,
    [dayFromToday(-100)],
  )
  // Tre giorni dentro la tolleranza, uno fuori, uno di 60 giorni fa.
  for (const [n, kcal] of [
    [0, 2100],
    [-1, 1900],
    [-2, 2050],
    [-3, 2400],
    [-60, 1500],
  ] as const) {
    await seedMeal(dayFromToday(n), 'lunch', [{ name: 'Pasto', grams: 100, kcal }])
  }
  for (const [n, kg] of [
    [-20, 81.5],
    [-1, 80.1],
  ] as const) {
    await sql(`insert into body_weights (day, source, weight_kg) values ($1, 'yazio', $2)`, [
      dayFromToday(n),
      kg,
    ])
  }

  await page.goto('/pasti')
  await page.getByRole('link', { name: 'Andamento' }).click()
  await expect(page.getByRole('heading', { name: 'Ultimi 30 giorni' })).toBeVisible()
  await expect(page.getByText(/^2\.?113$/)).toBeVisible()
  await expect(page.getByText('3 giorni su 4')).toBeVisible()
  await expect(page.getByText('−1,4 kg')).toBeVisible()
  await expect(page.getByRole('img', { name: /^Kcal al giorno dal / })).toBeVisible()

  await page.getByRole('button', { name: '90 giorni' }).click()
  await expect(page.getByRole('heading', { name: 'Ultimi 90 giorni' })).toBeVisible()
  await expect(page).toHaveURL(/giorni=90/)
  await expect(page.getByText('3 giorni su 5')).toBeVisible()
})

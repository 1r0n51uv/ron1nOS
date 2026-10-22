import { expect, test } from '@playwright/test'

import { dayFromToday, resetNutrition, seedMeal } from './db.ts'

test.beforeEach(async () => {
  await resetNutrition()
})

test('un pasto si corregge: grammi e righe, anche di un giorno passato (NUT-007)', async ({ page }) => {
  const day = dayFromToday(-1)
  await seedMeal(day, 'breakfast', [
    { name: 'Yogurt greco 0%', grams: 170, kcal: 99 },
    { name: "Fiocchi d'avena", grams: 50, kcal: 186 },
  ])
  await page.goto(`/pasti?giorno=${day}`)
  const breakfast = page.getByRole('article', { name: 'Colazione' })
  await expect(breakfast.getByText('285 kcal')).toBeVisible()

  await breakfast.getByRole('button', { name: "Cambia i grammi di Fiocchi d'avena" }).click()
  await breakfast.getByLabel("Grammi di Fiocchi d'avena").fill('100')
  await breakfast.getByLabel("Grammi di Fiocchi d'avena").press('Enter')
  await expect(breakfast.getByText('372 kcal')).toBeVisible()
  await expect(breakfast.getByText('471 kcal')).toBeVisible()

  await breakfast.getByRole('button', { name: 'Togli Yogurt greco 0%' }).click()
  await expect(breakfast.getByText('Yogurt greco 0%')).toBeHidden()
  await breakfast.getByRole('button', { name: "Togli Fiocchi d'avena" }).click()
  await expect(breakfast.getByText('Niente registrato.')).toBeVisible()
})

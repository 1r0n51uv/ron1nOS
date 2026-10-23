import { expect, test } from '@playwright/test'

import { dayFromToday, resetNutrition, seedMeal, sql } from './db.ts'

test.describe('Impostazioni › Formati (SET-010)', () => {
  test.beforeEach(() => resetNutrition())
  test.afterEach(() => sql('delete from preferences'))

  test('kJ cambia come si leggono le calorie dei pasti, i dati restano in kcal', async ({ page }) => {
    const day = dayFromToday(-1)
    await seedMeal(day, 'breakfast', [
      { name: 'Yogurt greco 0%', grams: 170, kcal: 99 },
      { name: "Fiocchi d'avena", grams: 50, kcal: 186 },
    ])

    await page.goto('/impostazioni/formati')
    await expect(page.getByLabel('Lingua')).toHaveText('Italiano')
    await page.getByRole('radio', { name: 'kJ' }).click()
    await expect(page.getByRole('radio', { name: 'kJ' })).toHaveAttribute('aria-checked', 'true')

    await page.goto(`/pasti?giorno=${day}`)
    const breakfast = page.getByRole('article', { name: 'Colazione' })
    await expect(breakfast.getByText(/^1\.?192 kJ$/)).toBeVisible()
    await expect(breakfast.getByText('414 kJ')).toBeVisible()

    const res = await page.request.get(`/api/v1/nutrition/day?date=${day}`)
    expect((await res.json()).totals.kcal).toBe(285)
  })

  test('fuso orario e peso si salvano e restano dopo il ricaricamento', async ({ page }) => {
    await page.goto('/impostazioni/formati')
    await page.getByLabel('Fuso orario').selectOption('America/New_York')
    await page.getByRole('radio', { name: 'lb' }).click()
    await expect(page.getByText('80 kg = 176,4 lb')).toBeVisible()

    await expect
      .poll(async () => (await (await page.request.get('/api/v1/preferences')).json()).formats)
      .toEqual({ timeZone: 'America/New_York', weightUnit: 'lb', energyUnit: 'kcal' })
    await page.reload()
    await expect(page.getByLabel('Fuso orario')).toHaveValue('America/New_York')
    await expect(page.getByRole('radio', { name: 'lb' })).toHaveAttribute('aria-checked', 'true')
  })
})

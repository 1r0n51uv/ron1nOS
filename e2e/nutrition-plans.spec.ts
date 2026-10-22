import { expect, test } from '@playwright/test'

import { dayFromToday, resetNutrition, sql } from './db.ts'

test.beforeEach(async () => {
  await resetNutrition()
  await sql(
    `insert into foods (name, source, calories_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g)
     values ('Riso basmati', 'custom', 350, 7, 78, 0.6), ('Petto di pollo', 'custom', 110, 23, 0, 1.2)`,
  )
})

test('un pasto si pianifica, si segna mangiato e si spegne (NUT-009)', async ({ page }) => {
  const day = dayFromToday(1)
  await page.goto(`/pasti?giorno=${day}`)
  const lunch = page.getByRole('article', { name: 'Pranzo' })
  await lunch.getByRole('button', { name: 'Pianifica Pranzo' }).click()

  const dialog = page.getByRole('dialog', { name: 'Cosa vuoi mangiare' })
  await expect(dialog.getByLabel('Giorno')).toHaveValue(day)
  for (const [q, name, grams] of [
    ['riso', 'Riso basmati', '80'],
    ['pollo', 'Petto di pollo', '150'],
  ]) {
    await dialog.getByLabel('Cerca un alimento').fill(q)
    await dialog
      .getByRole('list', { name: 'Risultati' })
      .getByRole('button', { name: new RegExp(name) })
      .click()
    await dialog.getByLabel('Quantità in grammi').fill(grams)
    await dialog.getByRole('button', { name: 'Aggiungi' }).click()
  }
  await dialog.getByRole('button', { name: 'Pianifica' }).click()
  await expect(dialog).toBeHidden()

  await expect(lunch.getByText('pianificato')).toBeVisible()
  await expect(lunch.getByText('445 kcal')).toBeVisible()
  await expect(page.getByRole('img', { name: /^0 kcal/ })).toBeVisible()

  const eaten = lunch.getByRole('switch', { name: 'Pranzo mangiato' })
  await eaten.click()
  await expect(eaten).toHaveAttribute('aria-checked', 'true')
  await expect(lunch.getByText('mangiato', { exact: true })).toBeVisible()
  await expect(page.getByRole('img', { name: /^445 kcal/ })).toBeVisible()

  // Spento, le righe del diario spariscono e il piano resta.
  await eaten.click()
  await expect(eaten).toHaveAttribute('aria-checked', 'false')
  await expect(lunch.getByText('pianificato')).toBeVisible()
  await expect(page.getByRole('img', { name: /^0 kcal/ })).toBeVisible()

  await lunch.getByRole('button', { name: 'Salta' }).click()
  await expect(lunch.getByText('saltato')).toBeVisible()
  await lunch.getByRole('button', { name: 'Ripristina' }).click()
  await expect(lunch.getByText('pianificato')).toBeVisible()
})

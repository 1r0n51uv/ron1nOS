import { expect, test } from '@playwright/test'

import { resetNutrition, sql } from './db.ts'

test.beforeEach(async () => {
  await resetNutrition()
  await sql(
    `insert into foods (name, source, calories_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g)
     values ('Riso basmati', 'custom', 350, 7, 78, 0.6), ('Petto di pollo', 'custom', 110, 23, 0, 1.2)`,
  )
})

test('una ricetta si crea, si registra oggi e si modifica (NUT-008)', async ({ page }) => {
  await page.goto('/pasti')
  await page.getByRole('link', { name: 'Ricette e spesa' }).click()
  await expect(page.getByRole('heading', { name: 'Ricette e spesa', level: 1 })).toBeVisible()
  await expect(page.getByText('Nessuna ricetta.')).toBeVisible()

  await page.getByRole('button', { name: 'Nuova' }).click()
  const form = page.getByRole('form', { name: 'Ricetta' })
  await form.getByLabel('Nome').fill('Riso e pollo')
  await form.getByLabel(/^Note/).fill('Pollo alla piastra.')
  for (const [q, name, grams] of [
    ['riso', 'Riso basmati', '80'],
    ['pollo', 'Petto di pollo', '150'],
  ]) {
    await page.getByLabel('Cerca un alimento').fill(q)
    await page
      .getByRole('list', { name: 'Risultati' })
      .getByRole('button', { name: new RegExp(name) })
      .click()
    await page.getByLabel('Quantità in grammi').fill(grams)
    await page.getByRole('button', { name: 'Aggiungi' }).click()
  }
  await expect(page.getByText('445 kcal · P 40 · C 62 · G 2')).toBeVisible()
  await page.getByRole('button', { name: 'Salva' }).click()

  await expect(page.getByRole('heading', { name: 'Riso e pollo' })).toBeVisible()
  await expect(page.getByText('Pollo alla piastra.')).toBeVisible()

  // Registra oggi apre il modale con la ricetta già nel pasto.
  await page.getByRole('button', { name: 'Registra oggi' }).click()
  const dialog = page.getByRole('dialog', { name: 'Cosa hai mangiato' })
  await expect(dialog.getByRole('list', { name: 'Nel pasto' }).getByText('Riso e pollo')).toBeVisible()
  await dialog.getByRole('radio', { name: 'Cena' }).click()
  await dialog.getByRole('button', { name: 'Registra' }).click()
  await expect(dialog).toBeHidden()

  await page.goto('/pasti')
  const dinner = page.getByRole('article', { name: 'Cena' })
  await expect(dinner.getByText('Riso basmati')).toBeVisible()
  await expect(dinner.getByText('Petto di pollo')).toBeVisible()

  // Modificata, la ricetta cambia; il pasto registrato no.
  await page.goto('/pasti/ricette')
  await page.getByRole('button', { name: 'Modifica' }).click()
  await page.getByRole('button', { name: 'Togli Petto di pollo' }).click()
  await page.getByRole('button', { name: 'Salva' }).click()
  await expect(page.getByRole('list', { name: 'Ricette' }).getByText('280')).toBeVisible()
  await page.goto('/pasti')
  await expect(dinner.getByText('445 kcal').first()).toBeVisible()
})

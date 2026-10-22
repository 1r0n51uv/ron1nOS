import { expect, test } from '@playwright/test'

import { resetNutrition, sql } from './db.ts'

test.beforeEach(async () => {
  await resetNutrition()
  await sql(
    `insert into foods (name, source, calories_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g)
     values ('Mela', 'custom', 52, 0.3, 14, 0.2)`,
  )
})

test('un template si crea, si compila e si applica a una settimana (NUT-010)', async ({ page }) => {
  await page.goto('/pasti')
  await page.getByRole('link', { name: 'Template' }).click()
  await expect(page.getByText('Nessun template. Creane uno con Nuovo.')).toBeVisible()

  await page.getByRole('button', { name: 'Nuovo' }).click()
  await page.getByLabel('Nome del template').fill('Definizione')
  await page.getByRole('button', { name: 'Crea' }).click()
  await expect(page.getByRole('heading', { name: 'Definizione', level: 1 })).toBeVisible()

  await page.getByRole('button', { name: 'Mercoledì Merenda: vuoto' }).click()
  const dialog = page.getByRole('dialog', { name: 'Mercoledì · Merenda' })
  await dialog.getByRole('tab', { name: 'Alimento' }).click()
  await dialog.getByLabel('Cerca un alimento').fill('mela')
  await dialog.getByRole('button', { name: /^Mela/ }).click()
  await dialog.getByLabel('Quantità in grammi').fill('180')
  await dialog.getByRole('button', { name: 'Aggiungi' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('button', { name: 'Mercoledì Merenda: Mela' })).toBeVisible()
  await expect(page.getByLabel('Totale Mercoledì: 94 kcal')).toBeVisible()

  await page.getByRole('radio', { name: /^Prossima/ }).click()
  await page.getByRole('button', { name: 'Applica' }).click()
  await expect(page.getByText('Creati 1 · sostituiti 0 · lasciati 0')).toBeVisible()

  // Il mercoledì della settimana prossima ha il pasto pianificato dal template.
  const res = await page.request.get('/api/v1/nutrition/templates')
  expect((await res.json()).templates[0].cells).toHaveLength(1)
  const today = new Date()
  const plans = await sql(
    `select p.day::text as day, t.name from planned_meals p join diet_templates t on t.id = p.template_id`,
  )
  expect(plans).toHaveLength(1)
  await page.goto(`/pasti?giorno=${plans[0].day}`)
  const snack = page.getByRole('article', { name: 'Merenda' })
  await expect(snack.getByText('dal template Definizione')).toBeVisible()
  await expect(snack.getByText('94 kcal').first()).toBeVisible()
  expect(new Date(`${plans[0].day}T12:00:00Z`).getUTCDay()).toBe(3)
  expect(new Date(`${plans[0].day}T12:00:00Z`) > today).toBe(true)
})

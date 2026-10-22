import { expect, test } from '@playwright/test'

import { resetNutrition, sql } from './db.ts'

// Lunedì della settimana prossima, nel fuso di Roma come il backend.
function nextMonday() {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Rome' })
  const d = new Date(`${today}T12:00:00Z`)
  const w = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 8 - w)
  return d.toISOString().slice(0, 10)
}

test.beforeEach(async () => {
  await resetNutrition()
  const [riso] = await sql(
    `insert into foods (name, source, calories_per_100g) values ('Riso basmati', 'custom', 350) returning id`,
  )
  const monday = nextMonday()
  for (const offset of [0, 2]) {
    const [plan] = await sql(
      `insert into planned_meals (day, slot) values ($1::date + $2::int, 'lunch') returning id`,
      [monday, offset],
    )
    await sql(
      `insert into planned_meal_items (planned_meal_id, food_id, food_name, quantity_g) values ($1, $2, 'Riso basmati', 80)`,
      [plan.id, riso.id],
    )
  }
})

test('la lista della spesa si genera dal piano e si spunta (NUT-011)', async ({ page }) => {
  await page.goto('/pasti/ricette')
  await page.getByRole('radiogroup', { name: 'Settimana del piano' }).getByRole('radio').nth(1).click()
  await page.getByRole('button', { name: 'Genera' }).click()
  await expect(page.getByText('Aggiunta una voce.')).toBeVisible()
  const plan = page.getByRole('list', { name: 'Dal piano' })
  await expect(plan.getByText('160 g')).toBeVisible()

  // Rigenerare non duplica.
  await page.getByRole('button', { name: 'Genera' }).click()
  await expect(page.getByText('Niente da aggiungere.')).toBeVisible()

  await page.getByLabel('Voce').fill('Limoni')
  await page.getByLabel('Quantità').fill('4')
  await page.getByRole('button', { name: 'Aggiungi' }).click()
  await expect(page.getByRole('list', { name: 'Aggiunte a mano' }).getByText('Limoni')).toBeVisible()

  await page.getByRole('checkbox', { name: 'Riso basmati' }).click()
  await expect(page.getByText('1 di 2')).toBeVisible()
  await page.getByRole('button', { name: 'Togli le spuntate' }).click()
  await expect(page.getByRole('list', { name: 'Dal piano' })).toBeHidden()
  await expect(page.getByText('0 di 1')).toBeVisible()
})

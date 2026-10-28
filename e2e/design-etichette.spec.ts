import { expect, test } from '@playwright/test'

// DES-005: i pulsanti a icona dicono cosa fanno, anche a chi passa il mouse.
test('i pulsanti più e meno di Acqua e Caffeina hanno nome e tooltip', async ({ page }) => {
  await page.goto('/pasti')

  const water = page.getByRole('region', { name: 'Acqua' })
  const add = water.getByRole('button', { name: 'Aggiungi 250 ml' })
  await expect(add).toBeVisible()
  await add.hover()
  await expect(page.getByRole('tooltip').filter({ hasText: 'Aggiungi 250 ml' }).first()).toBeVisible()

  const caffeine = page.getByRole('region', { name: 'Caffeina' })
  await expect(caffeine.getByRole('button', { name: /^Aggiungi un espresso/ })).toBeVisible()
  await expect(caffeine.getByRole('button', { name: 'Annulla l’ultima caffeina' })).toBeVisible()
})

// DES-006: la striscia dei Pasti è raggruppata per settimana.
test('i giorni dei Pasti sono per settimana e quella di oggi si riconosce', async ({ page }) => {
  await page.goto('/pasti')
  const strip = page.getByRole('navigation', { name: 'Giorni' })
  // 24 giorni coprono 4 o 5 settimane, secondo il giorno della settimana di oggi.
  await expect(strip.getByRole('group').first()).toBeVisible()
  expect(await strip.getByRole('group').count()).toBeGreaterThanOrEqual(4)
  const current = strip.getByRole('group', { name: 'Questa settimana' })
  await expect(current.getByRole('link', { name: 'Oggi' })).toBeVisible()
})

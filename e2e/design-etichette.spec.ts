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

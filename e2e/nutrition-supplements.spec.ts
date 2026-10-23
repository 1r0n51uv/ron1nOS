import { expect, test } from '@playwright/test'

import { resetNutrition } from './db.ts'

test.beforeEach(async () => {
  await resetNutrition()
})

test('gli integratori si aggiungono, si spuntano nel giorno e si disattivano (NUT-014)', async ({ page }) => {
  await page.goto('/impostazioni/moduli/nutrizione')
  await expect(page.getByText('Nessun integratore.')).toBeVisible()
  for (const [name, dose, when] of [
    ['Creatina', '5 g', 'mattina'],
    ['Vitamina D', '', 'sera'],
  ]) {
    await page.getByRole('button', { name: 'Nuovo integratore' }).click()
    const form = page.getByRole('form', { name: 'Nuovo integratore' })
    await form.getByLabel(/^Nome/).fill(name)
    if (dose) await form.getByLabel(/^Dose/).fill(dose)
    await form.getByLabel(/^Quando/).fill(when)
    await form.getByRole('button', { name: 'Aggiungi' }).click()
    await expect(page.getByRole('listitem', { name })).toBeVisible()
  }
  await expect(page.getByText('2 attivi')).toBeVisible()

  await page.goto('/pasti')
  const card = page.getByRole('region', { name: 'Integratori' })
  await expect(card.getByText('0 di 2')).toBeVisible()
  const creatina = card.getByRole('button', { name: /Creatina/ })
  await creatina.click()
  await expect(creatina).toHaveAttribute('aria-pressed', 'true')
  await expect(card.getByText('1 di 2')).toBeVisible()
  await page.reload()
  await expect(card.getByRole('button', { name: /Creatina/ })).toHaveAttribute('aria-pressed', 'true')

  // Disattivata, la Vitamina D esce dalla checklist di oggi.
  await page.goto('/impostazioni/moduli/nutrizione')
  await page.getByRole('listitem', { name: 'Vitamina D' }).getByRole('button', { name: 'Disattiva' }).click()
  await expect(page.getByText('1 attivo')).toBeVisible()
  await page.goto('/pasti')
  await expect(card.getByText('1 di 1')).toBeVisible()
  await expect(card.getByRole('button', { name: /Vitamina D/ })).toHaveCount(0)
})

import { expect, test } from '@playwright/test'

import { resetNutrition } from './db.ts'

// Il backend vero contro YAZIO finto (e2e/fake-yazio.ts).
const fake = 'http://localhost:18084'

test.beforeEach(async ({ request }) => {
  await resetNutrition()
  await request.post(`${fake}/__fake/reset`)
})

test('YAZIO si collega con Sincronizza ora, mostra l’errore e si spegne (NUT-020)', async ({
  page,
  request,
}) => {
  await page.goto('/impostazioni')
  const panel = page.getByRole('region', { name: 'YAZIO' })
  await expect(panel.getByText('non collegato')).toBeVisible()
  await expect(panel.getByText('mai')).toBeVisible()

  await panel.getByRole('button', { name: 'Sincronizza ora' }).click()
  await expect(panel.getByText('collegato', { exact: true })).toBeVisible()
  await expect(panel.getByText(/^oggi \d\d:\d\d$/)).toBeVisible()

  // Password cambiata in YAZIO: errore con il motivo.
  await request.post(`${fake}/__fake/state`, { data: { password: 'cambiata', tokens: {} } })
  await panel.getByRole('button', { name: 'Sincronizza ora' }).click()
  await expect(panel.getByText('errore', { exact: true })).toBeVisible()
  await expect(panel.getByRole('status')).toContainText('imposta prima una password')

  // Spenta, la sincronizzazione non parte e il diario resta.
  const tile = panel.getByRole('button', { name: /Sincronizzazione/ })
  await tile.click()
  await expect(tile).toHaveAttribute('aria-pressed', 'false')
  await expect(panel.getByRole('button', { name: 'Sincronizza ora' })).toBeDisabled()
  await page.reload()
  await expect(
    page.getByRole('region', { name: 'YAZIO' }).getByRole('button', { name: /Sincronizzazione/ }),
  ).toHaveAttribute('aria-pressed', 'false')
})

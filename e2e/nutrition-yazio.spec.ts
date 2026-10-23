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
  await page.goto('/impostazioni/moduli/nutrizione')
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

  // Versione dell'API bloccata da YAZIO: il motivo dice cosa cambiare.
  await request.post(`${fake}/__fake/reset`)
  await request.post(`${fake}/__fake/state`, { data: { versionBlocked: true } })
  await panel.getByRole('button', { name: 'Sincronizza ora' }).click()
  await expect(panel.getByRole('status')).toContainText('cambia la versione in YAZIO_URL')

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

test('obiettivo, attività e peso arrivano da YAZIO e l’obiettivo non si modifica più a mano (NUT-024)', async ({
  page,
  request,
}) => {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' })
  await request.post(`${fake}/__fake/state`, {
    data: {
      goals: { kcal: 2021, protein: 126, carbs: 227, fat: 67, water: 2500 },
      activity: { [today]: 77 },
      weights: [{ date: '2026-10-20 08:00:00', value: 80.1 }],
    },
  })
  await page.goto('/impostazioni/moduli/nutrizione')
  const goals = page.getByRole('button', { name: 'Salva' })
  await expect(goals).toBeVisible()

  const panel = page.getByRole('region', { name: 'YAZIO' })
  await expect(panel.getByText('Niente ancora: arriva con il primo giro.')).toBeVisible()
  await panel.getByRole('button', { name: 'Sincronizza ora' }).click()
  const imported = panel.getByRole('group', { name: 'Da YAZIO' })
  await expect(imported).toContainText(/2\.?021 kcal · P 126 · C 227 · G 67 g/)
  await expect(imported).toContainText('+77 kcal')
  await expect(imported).toContainText('80,1 kg · 20 ott')

  // Il pannello dell'obiettivo diventa in sola lettura.
  await expect(page.getByText("Si modifica nell'app YAZIO.")).toBeVisible()
  await expect(goals).toHaveCount(0)
})

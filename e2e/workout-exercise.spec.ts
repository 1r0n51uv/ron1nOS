import { expect, test } from '@playwright/test'

import { dayFromToday, resetNutrition } from './db.ts'

test.beforeEach(async () => {
  await resetNutrition()
})

// Panca piana in quattro sessioni, una di 8 mesi fa fuori dai 6 mesi.
function csv() {
  const rows = ['Date;Duration;Routine;Exercise;Set;Warmup;Weight;Reps/Time;Goal;Perception']
  const sessions: [number, number, number][] = [
    [-240, 100, 1],
    [-30, 60, 8],
    [-10, 70, 5],
    [-2, 72.5, 3],
  ]
  for (const [offset, kg, reps] of sessions) {
    const day = dayFromToday(offset)
    rows.push(`${day} 18:00;3600;Push;Panca piana;1;1;40;10;;`)
    rows.push(`${day} 18:00;3600;Push;Panca piana;2;0;${kg};${reps};;`)
  }
  return rows.join('\n')
}

test('la pagina di un esercizio mostra testata, grafico e ultime volte (GYM-008)', async ({ page }) => {
  const res = await page.request.post('/api/v1/workout/import', {
    multipart: { file: { name: 'liftin.csv', mimeType: 'text/csv', buffer: Buffer.from(csv()) } },
  })
  expect(res.ok()).toBe(true)

  await page.goto('/allenamenti')
  await page.getByRole('list', { name: 'Esercizi più allenati' }).getByRole('link').first().click()
  await expect(page).toHaveURL(/\/allenamenti\/esercizi\/panca%20piana$/)
  await expect(page.getByRole('heading', { name: 'Panca piana' })).toBeVisible()
  await expect(page.locator('dl')).toHaveText('1RM stimato100 kgpeso più alto100 kgsessioni4')

  // 6 mesi: 60 × (1 + 8/30) = 76, 70 × (1 + 5/30) ≈ 81,7, 72,5 × 1,1 = 79,75.
  await expect(page.getByRole('img', { name: '1RM stimato: da 76 kg a 80 kg, massimo 82 kg' })).toBeVisible()
  await page.getByRole('radio', { name: 'Tutto' }).click()
  await expect(
    page.getByRole('img', { name: '1RM stimato: da 100 kg a 80 kg, massimo 100 kg' }),
  ).toBeVisible()
  await page.getByRole('radio', { name: 'Volume' }).click()
  await expect(page.getByRole('img', { name: /^Volume: da 100 kg a 218 kg/ })).toBeVisible()

  const recent = page.getByRole('region', { name: 'Ultime volte' }).getByRole('link')
  await expect(recent).toHaveCount(3)
  await expect(recent.first()).toContainText('72,5 × 3')
  await recent.first().click()
  await expect(page).toHaveURL(/\/allenamenti\/sessioni\/[0-9a-f-]{36}$/)
})

test('il gruppo si assegna dalla pagina e resta dopo un nuovo import (GYM-011)', async ({ page }) => {
  const upload = () =>
    page.request.post('/api/v1/workout/import', {
      multipart: { file: { name: 'liftin.csv', mimeType: 'text/csv', buffer: Buffer.from(csv()) } },
    })
  expect((await upload()).ok()).toBe(true)

  await page.goto('/allenamenti/esercizi/panca%20piana')
  await page.getByRole('button', { name: 'Assegna il gruppo' }).click()
  await page.getByRole('dialog', { name: 'Gruppo muscolare' }).getByRole('radio', { name: 'Petto' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page.getByRole('button', { name: 'Gruppo · Petto' })).toBeVisible()

  expect((await upload()).ok()).toBe(true)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Gruppo · Petto' })).toBeVisible()
})

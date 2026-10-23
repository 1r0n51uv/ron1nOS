import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

import { dayFromToday, resetNutrition } from './db.ts'

test.beforeEach(async () => {
  await resetNutrition()
})

async function importCsv(page: Page, exercise: string) {
  const csv = [
    'Date;Duration;Routine;Exercise;Set;Warmup;Weight;Reps/Time;Goal;Perception',
    `${dayFromToday(0)} 07:30;2700;Push;${exercise};1;0;80;6;;`,
  ].join('\n')
  const res = await page.request.post('/api/v1/workout/import', {
    multipart: { file: { name: 'liftin.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) } },
  })
  expect(res.ok()).toBe(true)
}

const widget = (page: Page) =>
  page.locator('[data-slot="card"]').filter({ has: page.getByText('Allenamento', { exact: true }) })

test('senza dati il widget invita a importare il CSV (GYM-001)', async ({ page }) => {
  await page.goto('/')
  await widget(page).getByRole('link', { name: 'importa il CSV di Liftin’' }).click()
  await expect(page).toHaveURL(/\/allenamenti$/)
})

test('il widget mostra la foto dell ultimo allenamento e la settimana (GYM-001, GYM-014)', async ({
  page,
}) => {
  await importCsv(page, 'Panca piana')
  await page.goto('/')
  const card = widget(page)
  await expect(card.getByText('Push')).toBeVisible()
  await expect(card.getByText('oggi · 45 min')).toBeVisible()
  // La foto arriva dalla copia del catalogo nel backend.
  const photo = card.getByRole('img', { name: 'Panca piana' })
  await expect(photo).toHaveAttribute('src', /\/api\/v1\/workout\/catalog\/images\/Barbell_Bench_Press/)
  await expect
    .poll(() => photo.evaluate((img) => (img as { naturalWidth: number }).naturalWidth))
    .toBeGreaterThan(0)
  await expect(card.getByText('questa settimana')).toBeVisible()
  await expect(card.getByText('giorni di fila')).toBeVisible()
  await card.getByRole('link', { name: 'Dettagli' }).click()
  await expect(page.getByRole('heading', { name: 'Allenamenti', level: 1 })).toBeVisible()
})

test('un esercizio senza immagine se la sceglie dal catalogo (GYM-014)', async ({ page }) => {
  await importCsv(page, 'Croci ai cavi alti')
  await page.goto('/')
  const card = widget(page)
  await card.getByRole('button', { name: 'Scegli immagine per Croci ai cavi alti' }).click()
  const dialog = page.getByRole('dialog', { name: 'Croci ai cavi alti' })
  await dialog.getByLabel('Cerca nel catalogo').fill('dumb')
  await dialog.getByRole('button', { name: 'Dumbbell Flyes' }).click()
  await expect(dialog).toBeHidden()
  await expect(card.getByRole('img', { name: 'Croci ai cavi alti' })).toHaveAttribute('src', /Dumbbell_Flyes/)
})

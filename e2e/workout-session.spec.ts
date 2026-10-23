import { expect, test } from '@playwright/test'

import { dayFromToday, resetNutrition } from './db.ts'

test.beforeEach(async () => {
  await resetNutrition()
})

const CSV = [
  'Date;Duration;Routine;Exercise;Set;Warmup;Weight;Reps/Time;Goal;Perception',
  `${dayFromToday(-8)} 18:00;3600;Push;Panca piana;1;0;80;6;;`,
  `${dayFromToday(-1)} 18:00;3900;Push;Panca piana;1;1;40;10;;`,
  `${dayFromToday(-1)} 18:00;3900;Push;Panca piana;2;0;85;6;;`,
  `${dayFromToday(-1)} 18:00;3900;Push;Croci;1;0;14;12;;`,
  `${dayFromToday(-1)} 18:00;3900;Push;Plank;1;0;0;1:15;;`,
].join('\n')

const multipart = { file: { name: 'liftin.csv', mimeType: 'text/csv', buffer: Buffer.from(CSV) } }

test('il dettaglio di una sessione mostra serie, volume e record, e la sessione si elimina (GYM-005, GYM-006)', async ({
  page,
}) => {
  expect((await page.request.post('/api/v1/workout/import', { multipart })).ok()).toBe(true)
  await page.goto('/allenamenti')
  await page.getByRole('list', { name: 'Sessioni' }).getByRole('link').first().click()

  await expect(page.getByRole('heading', { name: 'Push', level: 1 })).toBeVisible()
  await expect(page.getByText(/^ieri · 18:00 · 1 h 05 min · 678 kg$/)).toBeVisible()
  const panca = page.getByRole('listitem', { name: 'Panca piana' })
  await expect(panca.getByText('Record')).toBeVisible()
  await expect(panca.getByText('40 × 10')).toHaveAttribute('title', 'Riscaldamento')
  await expect(page.getByRole('listitem', { name: 'Plank' }).getByText('1:15')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Volume per esercizio' }).getByRole('listitem')).toHaveCount(
    2,
  )

  await page.getByRole('button', { name: 'Elimina sessione' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Elimina' }).click()
  await expect(page).toHaveURL(/\/allenamenti$/)
  await expect(page.getByRole('list', { name: 'Sessioni' }).getByRole('listitem')).toHaveCount(1)

  // Un nuovo import dello stesso file non la riporta.
  await page.request.post('/api/v1/workout/import', { multipart })
  await page.reload()
  await expect(page.getByRole('list', { name: 'Sessioni' }).getByRole('listitem')).toHaveCount(1)
})

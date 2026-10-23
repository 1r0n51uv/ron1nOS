import { expect, test } from '@playwright/test'

import { dayFromToday, resetNutrition } from './db.ts'

test.beforeEach(async () => {
  await resetNutrition()
})

function csv() {
  const day = dayFromToday(0)
  return [
    'Date;Duration;Routine;Exercise;Set;Warmup;Weight;Reps/Time;Goal;Perception',
    `${day} 18:00;3600;Push;Panca piana;1;0;60;8;;`,
    `${day} 18:00;3600;Push;Panca piana;2;0;60;8;;`,
    `${day} 18:00;3600;Push;Esercizio mio;1;0;10;10;;`,
  ].join('\n')
}

test('il volume per gruppo cambia quando si assegna un gruppo (GYM-012)', async ({ page }) => {
  const res = await page.request.post('/api/v1/workout/import', {
    multipart: { file: { name: 'liftin.csv', mimeType: 'text/csv', buffer: Buffer.from(csv()) } },
  })
  expect(res.ok()).toBe(true)
  const put = await page.request.put('/api/v1/workout/exercises/panca%20piana/group', {
    data: { group: 'petto' },
  })
  expect(put.ok()).toBe(true)

  await page.goto('/allenamenti')
  const groups = page.getByRole('region', { name: 'Gruppi muscolari' })
  // 60 × 8 × 2 + 10 × 10 = 1060, con o senza il punto delle migliaia.
  await expect(groups.getByRole('img', { name: /questa settimana 1\.?060 kg$/ })).toBeVisible()
  await expect(groups.getByRole('list', { name: 'Legenda' }).getByRole('listitem')).toHaveText([
    'Petto',
    'Non assegnato',
  ])
  await groups.getByRole('radio', { name: 'Serie' }).click()
  await expect(groups.getByRole('img', { name: /questa settimana 3 serie$/ })).toBeVisible()
})

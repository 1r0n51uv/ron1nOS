import { expect, test } from '@playwright/test'

import { dayFromToday, resetNutrition } from './db.ts'

test.beforeEach(async () => {
  await resetNutrition()
})

test('dalla barra si apre la pagina: vuota solo l invito, poi tutte le sezioni (GYM-002)', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('navigation').getByRole('link', { name: 'Allenamenti' }).click()
  await expect(page).toHaveURL(/\/allenamenti$/)
  await expect(page.getByRole('heading', { name: 'Allenamenti', level: 1 })).toBeVisible()
  await expect(
    page.getByText('Importa il CSV esportato da Liftin’ per vedere qui i tuoi allenamenti.'),
  ).toBeVisible()
  await expect(page.getByRole('region')).toHaveCount(0)

  const day = dayFromToday(0)
  const csv = [
    'Date;Duration;Routine;Exercise;Set;Warmup;Weight;Reps/Time;Goal;Perception',
    `${day} 18:00;3600;Push;Panca piana;1;0;60;8;;`,
  ].join('\n')
  const res = await page.request.post('/api/v1/workout/import', {
    multipart: { file: { name: 'liftin.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) } },
  })
  expect(res.ok()).toBe(true)
  await page.reload()

  for (const name of [
    'Esercizi più allenati',
    'Nuovi record',
    'Gruppi muscolari',
    'Allenamenti per settimana',
    'Storico',
  ]) {
    await expect(page.getByRole('region', { name })).toBeVisible()
  }
  // Le foto sono in bianco e nero e scurite.
  const photo = page
    .getByRole('list', { name: 'Esercizi più allenati' })
    .getByRole('img', { name: 'Panca piana' })
  await expect(photo).toHaveCSS('filter', /grayscale\(1\)/)
})

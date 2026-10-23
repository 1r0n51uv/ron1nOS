import { expect, test } from '@playwright/test'

import { dayFromToday, resetNutrition } from './db.ts'

test.beforeEach(async () => {
  await resetNutrition()
})

function csv() {
  const rows = ['Date;Duration;Routine;Exercise;Set;Warmup;Weight;Reps/Time;Goal;Perception']
  rows.push(`${dayFromToday(-3)} 18:00;3600;Push;Panca piana;1;0;60;8;;`)
  rows.push(`${dayFromToday(-1)} 18:00;3600;Gambe;Squat;1;0;80;5;;`)
  rows.push(`${dayFromToday(-1)} 18:00;3600;Gambe;Esercizio mio;1;0;10;10;;`)
  return rows.join('\n')
}

test('l elenco degli esercizi si cerca e si completa dal filtro (GYM-009, GYM-011)', async ({ page }) => {
  const res = await page.request.post('/api/v1/workout/import', {
    multipart: { file: { name: 'liftin.csv', mimeType: 'text/csv', buffer: Buffer.from(csv()) } },
  })
  expect(res.ok()).toBe(true)

  await page.goto('/allenamenti')
  await page.getByRole('link', { name: 'Tutti gli esercizi' }).click()
  await expect(page).toHaveURL(/\/allenamenti\/esercizi$/)
  const list = page.getByRole('list', { name: 'Esercizi' })
  await expect(list.getByRole('listitem')).toHaveCount(3)
  // Dalla più recente: Panca piana è di tre giorni fa ed è l'ultima.
  await expect(list.getByRole('listitem').last()).toHaveAccessibleName('Panca piana')

  await page.getByRole('searchbox', { name: 'Cerca esercizi' }).fill('squ')
  await expect(list.getByRole('listitem')).toHaveCount(1)
  await page.getByRole('searchbox', { name: 'Cerca esercizi' }).fill('')

  // Tutti senza gruppo; Esercizio mio anche senza immagine.
  await page.getByRole('radio', { name: 'Da completare' }).click()
  await expect(list.getByRole('listitem')).toHaveCount(3)
  await page.getByRole('button', { name: 'Assegna il gruppo a Squat' }).click()
  await page.getByRole('dialog', { name: 'Gruppo muscolare' }).getByRole('radio', { name: 'Gambe' }).click()
  await expect(list.getByRole('listitem')).toHaveCount(2)
  await expect(
    list.getByRole('listitem', { name: 'Esercizio mio' }).getByRole('button', { name: /Scegli immagine/ }),
  ).toBeVisible()

  await page.getByRole('radio', { name: 'Tutti' }).click()
  await list.getByRole('listitem', { name: 'Squat' }).getByRole('link').click()
  await expect(page.getByRole('button', { name: 'Gruppo · Gambe' })).toBeVisible()
})

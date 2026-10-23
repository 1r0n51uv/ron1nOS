import { expect, test } from '@playwright/test'

import { resetNutrition, sql } from './db.ts'

// Ogni test parte con le tabelle vuote, quelle dell'allenamento comprese.
test.beforeEach(async () => {
  await resetNutrition()
})

const CSV = [
  'Date;Duration;Routine;Exercise;Set;Warmup;Weight;Reps/Time;Goal;Perception',
  '2026-10-19 18:00;3600;Push;Panca piana;1;0;80;6;;8',
  '2026-10-19 18:00;3600;Push;Panca piana;2;0;80;6;;8',
  '2026-10-21 07:30;2700;Gambe;Squat;1;0;100;5;;',
  ';;;;;;;;;',
].join('\n')

const file = (content: string) => ({ name: 'liftin.csv', mimeType: 'text/csv', buffer: Buffer.from(content) })

test('il CSV di Liftin si importa con anteprima, e un re-import non duplica (GYM-003)', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Allenamenti' }).click()
  await expect(page.getByRole('heading', { name: 'Allenamenti', level: 1 })).toBeVisible()

  await page.getByRole('button', { name: 'Importa CSV' }).click()
  const dialog = page.getByRole('dialog', { name: 'Importa CSV di Liftin’' })
  await dialog.getByLabel('File CSV di Liftin’').setInputFiles(file(CSV))
  const preview = dialog.getByLabel("Anteprima dell'import")
  await expect(preview.getByText('Allenamenti nuovi')).toBeVisible()
  await expect(preview).toContainText('Allenamenti nuovi2')
  await expect(preview).toContainText('Righe scartate1')
  await expect(preview).toContainText('19 ott 2026 – 21 ott 2026')
  expect(await sql('select 1 from workout_sessions')).toHaveLength(0)

  await dialog.getByRole('button', { name: 'Importa' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText('Import completato · 2 allenamenti nuovi, 0 aggiornati')).toBeVisible()
  expect(await sql('select 1 from workout_sets')).toHaveLength(3)

  // Lo stesso file di nuovo: niente di nuovo, niente di aggiornato.
  await page.getByRole('button', { name: 'Importa CSV' }).click()
  await dialog.getByLabel('File CSV di Liftin’').setInputFiles(file(CSV))
  await expect(dialog.getByLabel("Anteprima dell'import")).toContainText('Allenamenti nuovi0')
  await dialog.getByRole('button', { name: 'Importa' }).click()
  await expect(page.getByText('Import completato · 0 allenamenti nuovi, 0 aggiornati')).toBeVisible()
  expect(await sql('select 1 from workout_sets')).toHaveLength(3)
})

test('un CSV senza le colonne giuste mostra quali mancano (GYM-003)', async ({ page }) => {
  await page.goto('/allenamenti')
  await page.getByRole('button', { name: 'Importa CSV' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('File CSV di Liftin’').setInputFiles(file('Routine;Weight\nPush;80'))
  await expect(dialog.getByText('Colonne mancanti: Date, Exercise, Set')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Importa' })).toBeDisabled()
})

import { expect, test } from '@playwright/test'

import { resetNutrition, todayRome } from './db.ts'

// Il backend vero contro YAZIO finto (e2e/fake-yazio.ts).
const fake = 'http://localhost:18084'

test.beforeEach(async ({ request }) => {
  await resetNutrition()
  await request.post(`${fake}/__fake/reset`)
})

test('la quota del giorno somma l’attività letta da YAZIO, con il tetto (NUT-016)', async ({
  page,
  request,
}) => {
  await request.post(`${fake}/__fake/state`, { data: { activity: { [todayRome()]: 77 } } })
  await page.goto('/impostazioni')
  await page.getByRole('region', { name: 'YAZIO' }).getByRole('button', { name: 'Sincronizza ora' }).click()
  await expect(page.getByText('+77 kcal')).toBeVisible()

  await page.goto('/pasti')
  const aside = page.getByRole('complementary', { name: 'Riepilogo del giorno' })
  await expect(aside.getByRole('img', { name: /^0 kcal su 2\.?098$/ })).toBeVisible()
  await expect(aside.getByText(/obiettivo 2\.?021 · attività \+77 kcal/)).toBeVisible()

  // Una giornata molto attiva si ferma a +1200.
  await request.post(`${fake}/__fake/state`, { data: { activity: { [todayRome()]: 1850 } } })
  await page.goto('/impostazioni')
  await page.getByRole('region', { name: 'YAZIO' }).getByRole('button', { name: 'Sincronizza ora' }).click()
  await expect(page.getByText(/^\+1\.?850 kcal$/)).toBeVisible()
  await page.goto('/')
  await expect(page.getByRole('img', { name: /^0 kcal su 3\.?221$/ })).toBeVisible()
})

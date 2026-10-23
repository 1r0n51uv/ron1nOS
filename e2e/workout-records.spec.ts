import { expect, test } from '@playwright/test'

import { dayFromToday, resetNutrition } from './db.ts'

test.beforeEach(async () => {
  await resetNutrition()
})

// Panca piana migliora due volte, Squat una; Stacco solo la prima volta.
function csv() {
  const rows = ['Date;Duration;Routine;Exercise;Set;Warmup;Weight;Reps/Time;Goal;Perception']
  const add = (offset: number, ex: string, kg: number, reps: number) =>
    rows.push(`${dayFromToday(offset)} 18:00;3600;Push;${ex};1;0;${kg};${reps};;`)
  add(-20, 'Panca piana', 60, 8)
  add(-20, 'Squat', 80, 5)
  add(-12, 'Squat', 85, 5)
  add(-8, 'Panca piana', 65, 8)
  add(-2, 'Panca piana', 70, 8)
  add(-2, 'Stacco', 120, 5)
  return rows.join('\n')
}

test('la pagina mostra i nuovi record e l esercizio i suoi (GYM-010)', async ({ page }) => {
  const res = await page.request.post('/api/v1/workout/import', {
    multipart: { file: { name: 'liftin.csv', mimeType: 'text/csv', buffer: Buffer.from(csv()) } },
  })
  expect(res.ok()).toBe(true)

  await page.goto('/allenamenti')
  const records = page.getByRole('region', { name: 'Nuovi record' }).getByRole('link')
  await expect(records).toHaveCount(3)
  // 70 × (1 + 8/30) ≈ 88,7.
  await expect(records.nth(0)).toContainText('Panca piana1RM stimato · 89 kg')
  await expect(records.nth(1)).toContainText('Panca piana1RM stimato · 82 kg')
  await expect(records.nth(2)).toContainText('Squat1RM stimato · 99 kg')

  await page.goto('/allenamenti/esercizi/panca%20piana')
  const own = page.getByRole('region', { name: 'Record' }).getByRole('link')
  await expect(own.first()).toContainText('1RM stimato · 89 kg')
  await expect(own.filter({ hasText: 'Peso più alto' })).toContainText('70 kg')
  await expect(own.filter({ hasText: 'Volume in una sessione' })).toContainText('560 kg')
})

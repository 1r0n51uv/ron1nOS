import { expect, test } from '@playwright/test'

import { dayFromToday, resetNutrition } from './db.ts'

test.beforeEach(async () => {
  await resetNutrition()
})

// 22 sessioni a giorni alterni, Push e Gambe, con tre esercizi ciascuna.
function csv() {
  const rows = ['Date;Duration;Routine;Exercise;Set;Warmup;Weight;Reps/Time;Goal;Perception']
  for (let i = 0; i < 22; i++) {
    const routine = i % 2 ? 'Gambe' : 'Push'
    const day = dayFromToday(-i)
    for (const ex of routine === 'Push'
      ? ['Panca piana', 'Croci', 'Esercizio mio']
      : ['Squat', 'Pressa', 'Calf']) {
      rows.push(`${day} 18:00;2700;${routine};${ex};1;0;60;8;;`)
    }
  }
  return rows.join('\n')
}

test('lo storico si legge a pagine e si filtra per routine (GYM-004)', async ({ page }) => {
  const res = await page.request.post('/api/v1/workout/import', {
    multipart: { file: { name: 'liftin.csv', mimeType: 'text/csv', buffer: Buffer.from(csv()) } },
  })
  expect(res.ok()).toBe(true)

  await page.goto('/allenamenti')
  const list = page.getByRole('list', { name: 'Sessioni' })
  await expect(list.getByRole('listitem')).toHaveCount(20)
  await expect(list.getByRole('listitem').first()).toContainText('Push')
  await expect(list.getByRole('listitem').first()).toContainText('oggi · 45 min')
  await expect(list.getByRole('listitem').nth(1)).toContainText('ieri · 45 min')

  await page.getByRole('button', { name: 'Altre sessioni' }).click()
  await expect(list.getByRole('listitem')).toHaveCount(22)
  await expect(page.getByRole('button', { name: 'Altre sessioni' })).toBeHidden()

  await page.getByRole('radio', { name: 'Gambe' }).click()
  await expect(list.getByRole('listitem')).toHaveCount(11)
  await expect(list.getByRole('listitem').first()).toContainText('Gambe')
})

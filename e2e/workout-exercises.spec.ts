import { expect, test } from '@playwright/test'

import { dayFromToday, resetNutrition } from './db.ts'

test.beforeEach(async () => {
  await resetNutrition()
})

// Sette esercizi: Panca piana con più serie di tutti, Calf con meno, così
// resta fuori dai 6 più allenati.
function csv() {
  const rows = ['Date;Duration;Routine;Exercise;Set;Warmup;Weight;Reps/Time;Goal;Perception']
  const sets: Record<string, number> = {
    'Panca piana': 5,
    Squat: 4,
    Croci: 3,
    Stacco: 3,
    'Lat machine': 2,
    Plank: 2,
    Calf: 1,
  }
  for (let i = 0; i < 3; i++) {
    const day = dayFromToday(-i * 2)
    for (const [ex, n] of Object.entries(sets)) {
      for (let s = 1; s <= n; s++) {
        const value = ex === 'Plank' ? `1:${String(30 - i * 10).padStart(2, '0')}` : '8'
        rows.push(`${day} 18:00;3600;Push;${ex};${s};0;${ex === 'Plank' ? 0 : 50 + (2 - i) * 5};${value};;`)
      }
    }
  }
  return rows.join('\n')
}

test('la pagina mostra i 6 esercizi più allenati con il migliore (GYM-007)', async ({ page }) => {
  const res = await page.request.post('/api/v1/workout/import', {
    multipart: { file: { name: 'liftin.csv', mimeType: 'text/csv', buffer: Buffer.from(csv()) } },
  })
  expect(res.ok()).toBe(true)

  await page.goto('/allenamenti')
  const cards = page.getByRole('list', { name: 'Esercizi più allenati' }).getByRole('link')
  await expect(cards).toHaveCount(6)
  await expect(cards.first()).toContainText('Panca piana')
  // Il migliore è la sessione di oggi: 60 × (1 + 8/30) = 76 kg.
  await expect(cards.first()).toContainText('76 kg')
  await expect(cards.first().getByRole('img', { name: 'Andamento Panca piana' })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Esercizi più allenati' })).not.toContainText('Calf')
  await expect(cards.filter({ hasText: 'Plank' })).toContainText('1:30durata migliore')
  await expect(cards.first()).toHaveAttribute('href', '/allenamenti/esercizi/panca%20piana')
})

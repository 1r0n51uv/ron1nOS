import { expect, test } from '@playwright/test'

import { resetNutrition, todayRome } from './db.ts'

test.beforeEach(async () => {
  await resetNutrition()
})

test('la caffeina somma espressi e pasti, − annulla l’ultimo espresso (NUT-013)', async ({
  page,
  request,
}) => {
  const food = await request.post('/api/v1/nutrition/foods', {
    data: { name: 'Caffè espresso', kcal: 2, protein: 0.1, carbs: 0, fat: 0.2, caffeineMg: 212 },
  })
  const { id } = await food.json()
  await request.post('/api/v1/nutrition/meals', {
    data: { date: todayRome(), slot: 'breakfast', items: [{ foodId: id, grams: 30 }] },
  })

  await page.goto('/pasti')
  const caffeine = page.getByRole('region', { name: 'Caffeina' })
  await expect(caffeine.getByText('64 mg dai pasti', { exact: false })).toBeVisible()
  const undo = caffeine.getByRole('button', { name: 'Annulla l’ultima caffeina' })
  await expect(undo).toBeDisabled()

  await caffeine.getByRole('button', { name: 'Aggiungi un espresso, 80 mg' }).click()
  await expect(caffeine.getByText('144', { exact: true })).toBeVisible()
  await undo.click()
  await expect(caffeine.getByText('64', { exact: true })).toBeVisible()
  await expect(undo).toBeDisabled()
})

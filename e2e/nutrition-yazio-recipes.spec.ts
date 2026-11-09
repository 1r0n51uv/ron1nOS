import { expect, test } from '@playwright/test'

import { resetNutrition } from './db.ts'

// Il backend vero contro YAZIO finto (e2e/fake-yazio.ts).
const fake = 'http://localhost:18084'

test.beforeEach(async ({ request }) => {
  await resetNutrition()
  await request.post(`${fake}/__fake/reset`)
  await request.post(`${fake}/__fake/state`, {
    data: {
      recipes: [
        {
          id: 'r-colazione',
          name: 'Yogurt e mela',
          items: [
            { productId: 'p-yogurt', grams: 200 },
            { productId: 'p-mela', grams: 150 },
          ],
        },
      ],
    },
  })
})

test('i preferiti YAZIO diventano ricette, e un secondo import non li duplica (NUT-008)', async ({
  page,
}) => {
  await page.goto('/impostazioni/moduli/nutrizione')
  const panel = page.getByRole('region', { name: 'YAZIO' })
  await panel.getByRole('button', { name: 'Importa ricette preferite' }).click()
  await expect(panel.getByText('Ricette · 1 nuova · 0 aggiornate')).toBeVisible()

  await page.goto('/pasti/ricette')
  await expect(page.getByRole('heading', { name: 'Yogurt e mela' })).toBeVisible()
  await expect(page.getByText('Yogurt greco bianco 2%')).toBeVisible()

  await page.goto('/impostazioni/moduli/nutrizione')
  await page
    .getByRole('region', { name: 'YAZIO' })
    .getByRole('button', { name: 'Importa ricette preferite' })
    .click()
  await expect(page.getByText('Ricette · 0 nuove · 1 aggiornata')).toBeVisible()
  await page.goto('/pasti/ricette')
  await expect(page.getByRole('heading', { name: 'Yogurt e mela' })).toHaveCount(1)
})

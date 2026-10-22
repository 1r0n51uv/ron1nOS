import type { APIRequestContext } from '@playwright/test'
import { expect, test } from '@playwright/test'

import { resetNutrition, todayRome } from './db.ts'

// Il backend vero contro YAZIO e OpenFoodFacts finti.
const yazio = 'http://localhost:18084'
const foods = 'http://localhost:18083'

test.beforeEach(async ({ request }) => {
  await resetNutrition()
  await request.post(`${yazio}/__fake/reset`)
  await request.post(`${foods}/__fake/reset`)
})

type Consumed = { id: string; product_id: string; amount: number; daytime: string }
const consumed = async (request: APIRequestContext) =>
  ((await (await request.get(`${yazio}/__fake/state`)).json()) as { consumed: Consumed[] }).consumed

test('un pasto registrato in ron1nOS finisce in YAZIO e la riga lo dice (NUT-023)', async ({
  page,
  request,
}) => {
  expect((await page.request.post('/api/v1/nutrition/yazio/sync')).ok()).toBe(true)
  await page.goto('/pasti')
  await page.getByRole('button', { name: 'Registra in Pranzo' }).click()
  const dialog = page.getByRole('dialog', { name: 'Cosa hai mangiato' })
  await dialog.getByLabel('Cerca un alimento').fill('yogurt greco')
  await dialog
    .getByRole('button', { name: /Yogurt greco bianco 2%/ })
    .first()
    .click()
  await dialog.getByLabel('Quantità in grammi').fill('170')
  await dialog.getByRole('button', { name: 'Aggiungi' }).click()
  await dialog.getByRole('button', { name: 'Registra' }).click()
  const lunch = page.getByRole('article', { name: 'Pranzo' })
  await expect(lunch.getByText('in coda')).toBeVisible()

  expect((await page.request.post('/api/v1/nutrition/yazio/sync')).ok()).toBe(true)
  await page.reload()
  await expect(page.getByRole('article', { name: 'Pranzo' }).getByText('inviata')).toBeVisible()
  expect(await consumed(request)).toEqual([
    expect.objectContaining({ product_id: 'p-yogurt', amount: 170, daytime: 'lunch' }),
  ])
})

test('un alimento senza equivalente si abbina a mano in Impostazioni (NUT-023)', async ({
  page,
  request,
}) => {
  expect((await page.request.post('/api/v1/nutrition/yazio/sync')).ok()).toBe(true)
  const meal = await page.request.post('/api/v1/nutrition/meals', {
    data: {
      date: todayRome(),
      slot: 'dinner',
      items: [
        {
          food: {
            source: 'usda',
            externalId: 'usda-zuppa',
            name: 'Zuppa del casale',
            kcal: 80,
            protein: 3,
            carbs: 12,
            fat: 2,
          },
          grams: 300,
        },
      ],
    },
  })
  expect(meal.ok()).toBe(true)
  expect((await page.request.post('/api/v1/nutrition/yazio/sync')).ok()).toBe(true)

  await page.goto('/impostazioni')
  await expect(
    page.getByRole('region', { name: 'YAZIO' }).getByText('Senza equivalente').locator('..'),
  ).toContainText('1')
  const row = page
    .getByRole('region', { name: 'Senza equivalente' })
    .getByRole('listitem', { name: 'Zuppa del casale' })
  await expect(row).toContainText('USDA · 80 kcal / 100 g · usato oggi a Cena, 300 g')
  await row.getByRole('button', { name: 'Cerca in YAZIO' }).click()
  await row.getByRole('textbox').fill('mela')
  await row.getByRole('radio', { name: /Mela/ }).click()
  await row.getByRole('button', { name: 'Abbina e invia' }).click()
  await expect(page.getByRole('region', { name: 'Senza equivalente' })).toBeHidden()

  expect((await page.request.post('/api/v1/nutrition/yazio/sync')).ok()).toBe(true)
  expect(await consumed(request)).toEqual([expect.objectContaining({ product_id: 'p-mela', amount: 300 })])
})

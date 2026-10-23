import { expect, test } from '@playwright/test'

import { sql } from './db.ts'

test.describe('Impostazioni › Moduli (SET-005)', () => {
  test.afterEach(() => sql('delete from preferences; delete from dashboard_layouts'))

  test('un modulo spento sparisce da barra, dashboard e API, e si riaccende', async ({ page }) => {
    await page.goto('/impostazioni/moduli')
    const rail = page.getByRole('navigation', { name: 'Sezioni', exact: true })
    await expect(rail.getByRole('link', { name: 'Pasti' })).toBeVisible()

    await page.getByRole('switch', { name: 'Nutrizione' }).click()
    await page.getByRole('switch', { name: 'Download' }).click()
    await expect(page.getByRole('switch', { name: 'Download' })).not.toBeChecked()
    await expect(rail.getByRole('link', { name: 'Pasti' })).toHaveCount(0)

    await expect.poll(async () => (await page.request.get('/api/v1/downloads')).status()).toBe(404)
    const res = await page.request.get('/api/v1/nutrition/goals')
    expect(await res.json()).toMatchObject({ error: 'module_disabled' })

    await page.goto('/')
    await expect(page.locator('[data-widget="downloads.summary"]')).toHaveCount(0)
    await expect(page.locator('[data-widget="nutrition.summary"]')).toHaveCount(0)
    await expect(page.locator('[data-widget="notes.summary"]')).toBeVisible()

    await page.goto('/pasti')
    await expect(page.getByText('Modulo spento')).toBeVisible()
    await page.getByRole('link', { name: 'Impostazioni › Moduli' }).click()
    await page.getByRole('switch', { name: 'Nutrizione' }).click()
    await expect(rail.getByRole('link', { name: 'Pasti' })).toBeVisible()
    await expect.poll(async () => (await page.request.get('/api/v1/nutrition/goals')).status()).toBe(200)
  })
})

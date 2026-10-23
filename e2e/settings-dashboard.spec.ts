import { expect, test } from '@playwright/test'

import { sql } from './db.ts'

test.describe('Impostazioni › Dashboard (SET-004)', () => {
  test.afterEach(() => sql('delete from dashboard_layouts'))

  test('testata e widget si cambiano da qui e la dashboard li segue', async ({ page }) => {
    await page.request.put('/api/v1/dashboard/layouts/desktop', {
      data: {
        header: 'full',
        items: [
          { id: 'weight.summary', x: 0, y: 0, w: 8, h: 7 },
          { id: 'notes.summary', x: 8, y: 0, w: 8, h: 7 },
        ],
      },
    })
    await page.goto('/impostazioni/dashboard')
    await page.getByRole('radio', { name: 'Una riga' }).click()
    await page.getByRole('button', { name: 'Rimuovi · Nota fissata' }).click()
    await expect(page.getByRole('list', { name: 'Widget presenti' }).getByRole('listitem')).toHaveCount(1)

    await page.getByRole('button', { name: 'Opzioni · Peso' }).click()
    const dialog = page.getByRole('dialog', { name: 'Opzioni · Peso' })
    await dialog.getByRole('radio', { name: 'Compatta' }).click()
    await dialog.getByRole('button', { name: 'Fatto' }).click()

    await expect
      .poll(async () => (await (await page.request.get('/api/v1/dashboard/layouts/desktop')).json()).header)
      .toBe('line')
    await page.goto('/')
    await expect(page.getByTestId('dashboard-header-line')).toBeVisible()
    await expect(page.locator('[data-widget="weight.summary"]')).toBeVisible()
    await expect(page.locator('[data-widget="notes.summary"]')).toHaveCount(0)
    const saved = await (await page.request.get('/api/v1/dashboard/layouts/desktop')).json()
    expect(saved.items).toEqual([{ id: 'weight.summary', x: 0, y: 0, w: 8, h: 7, variant: 'compact' }])
  })
})

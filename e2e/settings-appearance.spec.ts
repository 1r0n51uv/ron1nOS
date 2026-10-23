import { expect, test } from '@playwright/test'

import { sql } from './db.ts'

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
)

test.describe('Impostazioni › Aspetto (SET-003)', () => {
  test.afterEach(() => sql('delete from preferences; delete from preference_background'))

  test('vetro e densità cambiano subito tutta l’interfaccia e restano dopo un ricaricamento', async ({
    page,
  }) => {
    await page.goto('/impostazioni/aspetto')
    const html = page.locator('html')
    await expect(html).toHaveAttribute('data-density', 'comfortable')

    await page.getByRole('radio', { name: 'Compatta' }).click()
    await page.getByRole('radio', { name: 'Intenso' }).click()
    await expect(html).toHaveAttribute('data-density', 'compact')
    await expect(html).toHaveAttribute('data-glass', 'strong')
    // Il padding delle card segue la densità.
    const card = page.locator('[data-slot="card"]').first()
    await expect(card).toHaveCSS('padding-top', '18px')

    await expect
      .poll(async () => (await (await page.request.get('/api/v1/preferences')).json()).appearance)
      .toMatchObject({ glass: 'strong', density: 'compact' })
    await page.reload()
    await expect(html).toHaveAttribute('data-density', 'compact')
    await expect(page.getByRole('radio', { name: 'Intenso' })).toHaveAttribute('aria-checked', 'true')
  })

  test('un’immagine caricata diventa lo sfondo e si può togliere', async ({ page }) => {
    await page.goto('/impostazioni/aspetto')
    await page.getByLabel('Immagine di sfondo').setInputFiles({
      name: 'sfondo.png',
      mimeType: 'image/png',
      buffer: PNG,
    })
    await expect(page.getByRole('radio', { name: 'Immagine' })).toHaveAttribute('aria-checked', 'true')
    await expect(page.locator('html')).toHaveAttribute('data-background', 'image')
    const image = await page.request.get('/api/v1/preferences/background')
    expect(image.headers()['content-type']).toBe('image/png')

    await page.getByRole('button', { name: 'Togli immagine' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-background', 'brace')
    await expect(page.getByRole('radio', { name: 'Immagine' })).toHaveCount(0)
  })

  test('un file che non è un’immagine viene rifiutato con il motivo', async ({ page }) => {
    await page.goto('/impostazioni/aspetto')
    await page.getByLabel('Immagine di sfondo').setInputFiles({
      name: 'finto.png',
      mimeType: 'image/png',
      buffer: Buffer.from('%PDF-1.7'),
    })
    await expect(page.getByRole('alert')).toHaveText('Serve un’immagine JPEG, PNG o WebP')
  })
})

import { expect, test } from '@playwright/test'

test.use({ storageState: { cookies: [], origins: [] } })

test('la dashboard si può installare: manifest, icone e service worker', async ({ page, request }) => {
  await page.goto('/login')
  // Dietro Cloudflare Access il manifest senza cookie torna come pagina di
  // login: serve la richiesta con le credenziali.
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('crossorigin', 'use-credentials')
  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  const manifest = await (await request.get(href!)).json()
  expect(manifest).toMatchObject({ name: 'ron1nOS', display: 'standalone', start_url: '/' })
  for (const icon of manifest.icons) expect((await request.get(icon.src)).ok()).toBe(true)
  expect(manifest.icons.map((i: { purpose: string }) => i.purpose)).toContain('maskable')
  expect((await request.get('/apple-touch-icon.png')).ok()).toBe(true)

  const worker = await page.evaluate<string>('navigator.serviceWorker.ready.then((r) => r.active.scriptURL)')
  expect(worker).toMatch(/\/sw\.js$/)
})

test.describe('tablet in verticale', () => {
  test.use({ viewport: { width: 820, height: 1180 } })

  test('il login entra con 4 cifre e si adatta alla larghezza', async ({ page }) => {
    await page.goto('/login')
    const field = page.getByLabel('Codice')
    await expect(field).toBeVisible()
    expect(await page.evaluate<number>('document.documentElement.scrollWidth')).toBeLessThanOrEqual(820)

    await field.fill('0000')
    await expect(page.getByRole('alert')).toHaveText('Codice non valido')
    await expect(field).toHaveValue('')

    await field.fill('4827')
    await expect(page).toHaveURL(/\/$/)
  })
})

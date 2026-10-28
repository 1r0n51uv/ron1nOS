import { expect, test } from '@playwright/test'

const BRAND = 'rgb(255, 42, 42)'
const BRAND_TEXT = 'rgb(255, 138, 138)'

// DES-001: il rosso è solo un segnale. In Home progressi, andamento, stato
// acceso e link sono in inchiostro; il rosso resta per ciò che è un problema.
test('nella Home il rosso non colora progressi, andamento, tasselli e link', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Luci soggiorno')).toBeVisible()

  const tile = page.getByRole('button', { name: /Luci soggiorno/ })
  await expect(tile).toHaveAttribute('aria-pressed', 'true')
  await expect(tile.locator('span').first()).not.toHaveCSS('background-color', BRAND)

  const bar = page.getByRole('progressbar', { name: /ubuntu/ }).locator('[data-slot=progress-indicator]')
  await expect(bar).toBeVisible()
  await expect(bar).not.toHaveCSS('background-color', BRAND)

  const line = page.getByRole('img', { name: /^Peso da/ }).locator('polyline')
  await expect(line).not.toHaveCSS('stroke', BRAND)

  // I link si riconoscono dalla sottolineatura, non dal solo colore.
  const link = page.getByRole('link', { name: 'Dettagli' }).first()
  await expect(link).not.toHaveCSS('color', BRAND_TEXT)
  await expect(link).toHaveCSS('text-decoration-line', 'underline')

  // Il problema vero resta rosso: il quadratino del container fermo.
  const alert = page.getByRole('status').filter({ hasText: 'gitea' })
  await expect(alert).toBeVisible()
})

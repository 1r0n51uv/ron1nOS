import { expect, test } from '@playwright/test'

// DES-003: trasparenza ridotta e contrasto alto del sistema.
test('con la trasparenza ridotta il vetro è opaco e senza sfocatura', async ({ page }) => {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }],
  })
  await page.goto('/')
  const card = page.locator('[data-widget="nutrition.summary"] [data-slot=card]')
  await expect(card).toBeVisible()
  await expect(card).toHaveCSS('backdrop-filter', 'none')

  await page.getByRole('button', { name: 'Aggiungi' }).first().click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toHaveCSS('backdrop-filter', 'none')
  await expect(dialog).toHaveCSS('background-color', 'rgb(22, 22, 24)')
})

test('senza la preferenza il vetro sfoca', async ({ page }) => {
  await page.goto('/')
  const card = page.locator('[data-widget="nutrition.summary"] [data-slot=card]')
  await expect(card).not.toHaveCSS('backdrop-filter', 'none')
})

test.describe('contrasto alto', () => {
  test.use({ contrast: 'more' })

  test('il testo secondario passa a pieno inchiostro e i bordi si schiariscono', async ({ page }) => {
    await page.goto('/')
    const label = page.getByText('Prossimo pasto')
    await expect(label).toBeVisible()
    await expect(label).toHaveCSS('color', 'rgb(242, 242, 242)')
    await expect(page.locator('[data-widget="nutrition.summary"] [data-slot=card]')).toHaveCSS(
      'border-top-color',
      'rgba(255, 255, 255, 0.55)',
    )
  })
})

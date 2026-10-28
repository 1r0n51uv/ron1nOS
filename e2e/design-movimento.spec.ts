import { expect, test } from '@playwright/test'

// DES-002: con il movimento ridotto del sistema le animazioni si azzerano.
test.describe('movimento ridotto', () => {
  test.use({ reducedMotion: 'reduce' })

  test('il dialogo si apre senza animazione', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Aggiungi' }).first().click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog).toHaveCSS('animation-duration', /^(0s|1e-05s)$/)
  })

  test('gli scheletri di caricamento non pulsano', async ({ page }) => {
    // La risposta non arriva mai: lo scheletro resta, senza gara con i dati.
    await page.route('**/api/v1/server/stats', () => new Promise(() => {}))
    await page.goto('/')
    const skeleton = page.locator('[data-slot=skeleton]').first()
    await expect(skeleton).toBeVisible()
    await expect(skeleton).toHaveCSS('animation-iteration-count', '1')
    // Il testo dice comunque che sta caricando.
    await expect(page.getByLabel('Server: caricamento')).toBeVisible()
  })
})

test('senza la preferenza il dialogo si anima come prima', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Aggiungi' }).first().click()
  await expect(page.getByRole('dialog')).not.toHaveCSS('animation-duration', '0s')
})

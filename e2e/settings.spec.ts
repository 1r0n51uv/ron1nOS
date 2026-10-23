import { expect, test } from '@playwright/test'

test.describe('impostazioni a sezioni (SET-001)', () => {
  test('/impostazioni apre Aspetto e ogni sezione ha il suo indirizzo', async ({ page }) => {
    await page.goto('/impostazioni')
    await expect(page).toHaveURL(/\/impostazioni\/aspetto$/)
    await expect(page.getByRole('heading', { level: 2, name: 'Aspetto' })).toBeVisible()

    const menu = page.getByRole('navigation', { name: 'Sezioni delle impostazioni' })
    await menu.getByRole('link', { name: 'Dashboard' }).click()
    await expect(page).toHaveURL(/\/impostazioni\/dashboard$/)
    await expect(page.getByRole('button', { name: 'Ripristina layout predefinito' })).toBeVisible()

    await menu.getByRole('link', { name: 'Account' }).click()
    await expect(page.getByRole('region', { name: 'Accesso' })).toBeVisible()

    // Un indirizzo diretto apre la sua sezione anche ricaricando.
    await page.goto('/impostazioni/informazioni')
    await expect(page.getByRole('heading', { level: 2, name: 'Informazioni' })).toBeVisible()
    await expect(menu.getByRole('link', { name: 'Informazioni' })).toHaveAttribute('aria-current', 'page')
  })

  test('le impostazioni di Nutrizione stanno sotto Moduli', async ({ page }) => {
    await page.goto('/impostazioni/moduli')
    await page.getByRole('link', { name: /Nutrizione/ }).click()
    await expect(page).toHaveURL(/\/impostazioni\/moduli\/nutrizione$/)
    await expect(page.getByRole('heading', { level: 2, name: 'Nutrizione' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'YAZIO' })).toBeVisible()
    await page.getByRole('link', { name: 'Moduli', exact: true }).last().click()
    await expect(page).toHaveURL(/\/impostazioni\/moduli$/)
  })
})

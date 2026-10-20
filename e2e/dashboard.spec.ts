import { expect, test } from '@playwright/test'

const widgets = [
  'Nutrizione',
  'Allenamento',
  'Peso',
  'Casa',
  'Server',
  'Container',
  'Download',
  'Nota fissata',
]

test('la dashboard mostra tutti i widget con i dati', async ({ page }) => {
  await page.goto('/')
  for (const title of widgets) {
    await expect(page.getByText(title, { exact: true }).first()).toBeVisible()
  }
  // Finito il caricamento non restano skeleton.
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0)
})

test('la navigazione porta alle sezioni e segna la voce attiva', async ({ page }) => {
  await page.goto('/')
  const nav = page.getByRole('navigation', { name: 'Sezioni' })
  await nav.getByRole('link', { name: 'Pasti' }).click()
  await expect(page).toHaveURL(/\/pasti$/)
  await expect(nav.getByRole('link', { name: 'Pasti' })).toHaveAttribute('aria-current', 'page')
  await nav.getByRole('link', { name: 'ron1nOS, dashboard' }).click()
  await expect(page).toHaveURL(/\/$/)
})

test('una rotta sconosciuta mostra la pagina non trovata', async ({ page }) => {
  await page.goto('/non-esiste')
  await expect(page.getByText('Pagina non trovata')).toBeVisible()
})

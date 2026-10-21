import { expect, test, type Page } from '@playwright/test'

// Widget Server (specifica docs/specs/server.md).
function serverWidget(page: Page) {
  return page.locator('[data-slot="card"]').filter({ has: page.getByText('Server', { exact: true }) })
}

test('il widget Server mostra gli anelli CPU, RAM e SSD (SRV-001)', async ({ page }) => {
  await page.goto('/')
  const widget = serverWidget(page)
  for (const key of ['CPU', 'RAM', 'SSD']) {
    await expect(widget.getByRole('img', { name: new RegExp(`^${key} \\d{1,3}%`) })).toBeVisible()
  }
})

test('la testata mostra temperatura e uptime (SRV-002)', async ({ page }) => {
  await page.goto('/')
  await expect(serverWidget(page).getByText(/^\d+ °C · \d+ (g|h)$/)).toBeVisible()
})

test('la riga Rete mostra le velocità (SRV-003)', async ({ page }) => {
  await page.goto('/')
  const widget = serverWidget(page)
  await expect(widget.getByText('Rete', { exact: true })).toBeVisible()
  await expect(widget.getByText(/^↓ [\d,]+ (kB|MB)\/s · ↑ [\d,]+ (kB|MB)\/s$/)).toBeVisible()
})

test('la tabella mostra i 3 container che consumano di più (SRV-004)', async ({ page }) => {
  await page.goto('/')
  const table = serverWidget(page).getByRole('table')
  await expect(table.getByRole('columnheader')).toHaveText(['Container', 'CPU', 'RAM'])
  await expect(table.getByRole('row')).toHaveCount(4)
})

test('un valore sopra soglia è segnalato (SRV-005)', async ({ page }) => {
  await page.goto('/')
  await expect(serverWidget(page).getByRole('img', { name: /^SSD \d+%, sopra soglia$/ })).toBeVisible()
})

test('il widget si aggiorna senza ricaricare la pagina (SRV-007)', async ({ page }) => {
  await page.goto('/')
  await expect(serverWidget(page).getByRole('img', { name: /^CPU/ })).toBeVisible()
  // Dopo un giro di aggiornamento il widget ha ancora i dati, senza skeleton.
  await page.waitForTimeout(5_500)
  await expect(serverWidget(page).getByRole('img', { name: /^CPU/ })).toBeVisible()
  await expect(serverWidget(page).locator('[aria-busy="true"]')).toHaveCount(0)
})

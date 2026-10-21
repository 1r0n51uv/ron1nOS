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

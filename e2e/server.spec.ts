import { expect, test, type Page } from '@playwright/test'

// Widget Server (specifica docs/specs/server.md) sul backend vero, contro il
// Glances finto di e2e/fake-glances.ts.
const fake = 'http://localhost:18081'

function serverWidget(page: Page) {
  return page.locator('[data-slot="card"]').filter({ has: page.getByText('Server', { exact: true }) })
}

test.afterEach(async ({ request }) => {
  await request.post(`${fake}/__fake/reset`)
})

test('GET /api/v1/server/stats riduce i dati di Glances (SRV-008)', async ({ request }) => {
  const res = await request.get('/api/v1/server/stats')
  expect(res.ok()).toBe(true)
  const body = await res.json()
  expect(body).toMatchObject({ cpu: 23.4, ram: 57.2, disk: 64.3, tempC: 52 })
  expect(body.containers.map((c: { name: string }) => c.name)).not.toContain('gitea')
  expect(JSON.stringify(body)).not.toMatch(/processlist|cmdline|password/)
})

test('il widget Server mostra gli anelli CPU, RAM e SSD (SRV-001)', async ({ page }) => {
  await page.goto('/')
  const widget = serverWidget(page)
  await expect(widget.getByRole('img', { name: 'CPU 23%' })).toBeVisible()
  await expect(widget.getByRole('img', { name: 'RAM 57%' })).toBeVisible()
  await expect(widget.getByRole('img', { name: 'SSD 64%' })).toBeVisible()
})

test('la testata mostra temperatura e uptime (SRV-002)', async ({ page }) => {
  await page.goto('/')
  await expect(serverWidget(page).getByText('52 °C · 41 g')).toBeVisible()
})

test('la riga Rete mostra le velocità (SRV-003)', async ({ page }) => {
  await page.goto('/')
  const widget = serverWidget(page)
  await expect(widget.getByText('Rete', { exact: true })).toBeVisible()
  await expect(widget.getByText('↓ 12,4 MB/s · ↑ 820 kB/s')).toBeVisible()
})

test('la tabella mostra i 3 container che consumano di più (SRV-004)', async ({ page }) => {
  await page.goto('/')
  const table = serverWidget(page).getByRole('table')
  await expect(table.getByRole('columnheader')).toHaveText(['Container', 'CPU', 'RAM'])
  await expect(table.getByRole('row')).toHaveText([
    'ContainerCPURAM',
    'qbittorrent14%412 MB',
    '1r0-api6%188 MB',
    'postgres3%1,2 GB',
  ])
})

test('una temperatura alta è segnalata (SRV-005)', async ({ page, request }) => {
  await request.post(`${fake}/__fake/state`, { data: { tempC: 88 } })
  await page.goto('/')
  // Il backend tiene i dati per 2 s: il valore nuovo può arrivare al refresh.
  await expect(serverWidget(page).getByText('CPU a 88 °C')).toBeVisible({ timeout: 10_000 })
})

test('Glances spento: stato offline, poi il widget riprende da solo (SRV-006)', async ({ page, request }) => {
  await page.goto('/')
  const widget = serverWidget(page)
  await expect(widget.getByRole('img', { name: 'CPU 23%' })).toBeVisible()

  await request.post(`${fake}/__fake/state`, { data: { online: false } })
  await expect(widget.getByText('Glances · offline')).toBeVisible({ timeout: 15_000 })
  await expect(widget.getByRole('img', { name: 'CPU 23%' })).toHaveCount(0)

  await request.post(`${fake}/__fake/state`, { data: { online: true } })
  await expect(widget.getByRole('img', { name: 'CPU 23%' })).toBeVisible({ timeout: 10_000 })
})

test('il widget si aggiorna da solo senza ricaricare la pagina (SRV-007)', async ({ page, request }) => {
  await page.goto('/')
  const widget = serverWidget(page)
  await expect(widget.getByText('52 °C · 41 g')).toBeVisible()
  await request.post(`${fake}/__fake/state`, { data: { tempC: 61 } })
  await expect(widget.getByText('61 °C · 41 g')).toBeVisible({ timeout: 10_000 })
  await expect(widget.locator('[aria-busy="true"]')).toHaveCount(0)
})

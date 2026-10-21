import { expect, test } from '@playwright/test'

// Widget Download sui dati del qBittorrent finto (e2e/fake-qbittorrent.ts).
test('il widget Download mostra i download in corso di qBittorrent', async ({ page }) => {
  await page.goto('/')
  const widget = page.locator('[data-slot="card"]', { hasText: 'Download' })
  await expect(widget.getByText('↓ 12,1 MB/s')).toBeVisible()
  const list = widget.getByRole('list', { name: 'Download in corso' })
  await expect(list.getByRole('listitem')).toHaveCount(2)
  await expect(list.getByRole('listitem').first()).toContainText('ubuntu-24.04.3-desktop-amd64.iso')
  await expect(
    widget.getByRole('progressbar', { name: 'ubuntu-24.04.3-desktop-amd64.iso 72%' }),
  ).toBeVisible()
  await expect(widget.getByText('3 min rimanenti')).toBeVisible()
  await expect(widget.getByText('1 in coda · 1 in seed')).toBeVisible()
})

test('il widget si aggiorna senza tornare allo scheletro', async ({ page }) => {
  await page.goto('/')
  const widget = page.locator('[data-slot="card"]', { hasText: 'Download' })
  await expect(widget.getByText('↓ 12,1 MB/s')).toBeVisible()
  const refetch = page.waitForResponse((r) => r.url().endsWith('/api/v1/downloads'))
  await refetch
  await page.waitForResponse((r) => r.url().endsWith('/api/v1/downloads'), { timeout: 8_000 })
  await expect(widget.getByLabel('Download: caricamento')).toHaveCount(0)
  await expect(widget.getByText('↓ 12,1 MB/s')).toBeVisible()
})

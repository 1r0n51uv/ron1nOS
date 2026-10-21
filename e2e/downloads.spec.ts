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

test.describe('qBittorrent non disponibile', () => {
  const fake = 'http://localhost:18080'
  test.afterEach(async ({ request }) => {
    await request.post(`${fake}/__fake/reset`)
  })

  test('spento: il widget lo dice e riprende da solo', async ({ page, request }) => {
    await page.goto('/')
    const widget = page.locator('[data-slot="card"]', { hasText: 'Download' })
    await expect(widget.getByText('↓ 12,1 MB/s')).toBeVisible()

    await request.post(`${fake}/__fake/state`, { data: { online: false } })
    // Entro due aggiornamenti (5 s l'uno).
    await expect(widget.getByText('qBittorrent · offline')).toBeVisible({ timeout: 11_000 })
    await expect(widget.getByText('qBittorrent non raggiungibile. Riprovo ogni 5 secondi.')).toBeVisible()

    await request.post(`${fake}/__fake/state`, { data: { online: true } })
    await expect(widget.getByText('↓ 12,1 MB/s')).toBeVisible({ timeout: 11_000 })
  })

  test('credenziali errate: accesso non riuscito', async ({ page, request }) => {
    await request.post(`${fake}/__fake/state`, { data: { password: 'cambiata' } })
    await page.goto('/')
    const widget = page.locator('[data-slot="card"]', { hasText: 'Download' })
    await expect(
      widget.getByText('Accesso a qBittorrent non riuscito. Riprovo ogni 5 secondi.'),
    ).toBeVisible()
  })
})

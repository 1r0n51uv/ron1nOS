import { expect, test, type Page } from '@playwright/test'

import { DEBIAN_DVD } from './torrents.ts'

// Passo 4 del wizard (DL-007): riepilogo, avvio e torrent nel widget.
const fake = 'http://localhost:18080'
const HASH = '3b1a1469c180f447b77021074dbbccaef62611e7'

type Added = { hash: string; state: string; tags: string; files: { index: number; priority: number }[] }

test.afterEach(async ({ request }) => {
  await request.post(`${fake}/__fake/reset`)
})

async function toSummary(page: Page, source: 'file' | 'magnet') {
  await page.goto('/')
  const widget = page.locator('[data-slot="card"]', { hasText: 'Download' })
  await expect(widget.getByText('↓ 12,1 MB/s')).toBeVisible()
  await widget.getByRole('button', { name: 'Aggiungi' }).click()
  const dialog = page.getByRole('dialog')
  if (source === 'file') {
    await dialog.getByLabel('File .torrent').setInputFiles({
      name: 'debian.torrent',
      mimeType: 'application/x-bittorrent',
      buffer: DEBIAN_DVD,
    })
  } else {
    await dialog.getByRole('tab', { name: 'Link' }).click()
    await dialog.getByLabel('Link magnet o URL di un .torrent').fill(`magnet:?xt=urn:btih:${HASH}`)
  }
  await dialog.getByRole('button', { name: 'Avanti' }).click()
  await expect(dialog.getByText('4 file · 7,9 GB')).toBeVisible({ timeout: 8_000 })
  await dialog.getByRole('button', { name: 'Avanti' }).click()
  await dialog
    .getByRole('list', { name: 'File del torrent' })
    .getByText('debian-13.1.0-amd64-DVD-2.iso')
    .click()
  await dialog.getByRole('button', { name: 'Avanti' }).click()
  await expect(dialog.getByRole('heading', { name: 'Riepilogo' })).toBeVisible()
  return { dialog, widget }
}

for (const source of ['file', 'magnet'] as const) {
  test(`da ${source}: Avvia scarica solo i file scelti e il torrent compare nel widget`, async ({
    page,
    request,
  }) => {
    const { dialog, widget } = await toSummary(page, source)
    await expect(dialog.getByText('3 file su 4')).toBeVisible()
    await expect(dialog.getByText('dopo il download: 408 GB')).toBeVisible()
    await expect(dialog.getByText('/downloads')).toBeVisible()

    await dialog.getByRole('button', { name: 'Avvia' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    const list = widget.getByRole('list', { name: 'Download in corso' })
    await expect(list.getByText('debian-13.1.0-amd64-DVD')).toBeVisible({ timeout: 6_000 })

    const [t] = (await (await request.get(`${fake}/__fake/torrents`)).json()) as Added[]
    expect(t.state).toBe('downloading')
    expect(t.tags).toBe('')
    expect(t.files.map((f) => f.priority)).toEqual([1, 0, 1, 1])
  })
}

test('con spazio insufficiente Avvia resta disattivato', async ({ page, request }) => {
  await request.post(`${fake}/__fake/state`, { data: { freeSpace: 2_100_000_000 } })
  const { dialog } = await toSummary(page, 'file')
  await expect(dialog.getByText('Spazio insufficiente.')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Avvia' })).toBeDisabled()
})

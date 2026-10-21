import { expect, test, type Page } from '@playwright/test'

import { DEBIAN_DVD } from './torrents.ts'

// Annullare il wizard (DL-008): in qBittorrent non resta nulla.
const fake = 'http://localhost:18080'
const HASH = '3b1a1469c180f447b77021074dbbccaef62611e7'

test.afterEach(async ({ request }) => {
  await request.post(`${fake}/__fake/reset`)
})

async function openWizard(page: Page) {
  await page.goto('/')
  const widget = page.locator('[data-slot="card"]', { hasText: 'Download' })
  await expect(widget.getByText('↓ 12,1 MB/s')).toBeVisible()
  await widget.getByRole('button', { name: 'Aggiungi' }).click()
  return page.getByRole('dialog')
}

async function magnet(page: Page) {
  const dialog = await openWizard(page)
  await dialog.getByRole('tab', { name: 'Link' }).click()
  await dialog.getByLabel('Link magnet o URL di un .torrent').fill(`magnet:?xt=urn:btih:${HASH}`)
  await dialog.getByRole('button', { name: 'Avanti' }).click()
  return dialog
}

async function added(page: Page) {
  return (await (await page.request.get(`${fake}/__fake/torrents`)).json()) as unknown[]
}

test('un magnet annullato durante i metadati sparisce da qBittorrent', async ({ page, request }) => {
  await request.post(`${fake}/__fake/state`, { data: { metadata: 'never' } })
  const dialog = await magnet(page)
  await expect(dialog.getByText('Recupero dei metadati…')).toBeVisible()
  expect(await added(page)).toHaveLength(1)
  await dialog.getByRole('button', { name: 'Annulla' }).click()
  await expect.poll(() => added(page)).toHaveLength(0)
})

test('un magnet annullato con Esc alla scelta dei file sparisce', async ({ page }) => {
  const dialog = await magnet(page)
  await expect(dialog.getByText('4 file · 7,9 GB')).toBeVisible({ timeout: 8_000 })
  await dialog.getByRole('button', { name: 'Avanti' }).click()
  await expect(dialog.getByRole('heading', { name: 'Cosa scaricare' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect.poll(() => added(page)).toHaveLength(0)
})

test('un file annullato al riepilogo non arriva mai a qBittorrent', async ({ page }) => {
  const dialog = await openWizard(page)
  await dialog.getByLabel('File .torrent').setInputFiles({
    name: 'debian.torrent',
    mimeType: 'application/x-bittorrent',
    buffer: DEBIAN_DVD,
  })
  for (let i = 0; i < 3; i++) await dialog.getByRole('button', { name: 'Avanti' }).click()
  await expect(dialog.getByRole('heading', { name: 'Riepilogo' })).toBeVisible()
  await dialog.getByRole('button', { name: 'Chiudi' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(await added(page)).toHaveLength(0)
})

test('Indietro torna al passo precedente con le scelte fatte', async ({ page }) => {
  const dialog = await magnet(page)
  await expect(dialog.getByText('4 file · 7,9 GB')).toBeVisible({ timeout: 8_000 })
  await dialog.getByRole('button', { name: 'Avanti' }).click()
  await dialog.getByRole('list', { name: 'File del torrent' }).getByText('SHA256SUMS.sign').click()
  await dialog.getByRole('button', { name: 'Avanti' }).click()
  await expect(dialog.getByText('3 file su 4')).toBeVisible()
  await dialog.getByRole('button', { name: 'Indietro' }).click()
  await expect(dialog.getByText('3 file · 7,9 GB su 7,9 GB')).toBeVisible()
  await dialog.getByRole('button', { name: 'Indietro' }).click()
  await dialog.getByRole('button', { name: 'Indietro' }).click()
  await expect(dialog.getByLabel('Link magnet o URL di un .torrent')).toHaveValue(
    `magnet:?xt=urn:btih:${HASH}`,
  )
  // Tornando alla sorgente la bozza magnet è stata tolta.
  await expect.poll(() => added(page)).toHaveLength(0)
})

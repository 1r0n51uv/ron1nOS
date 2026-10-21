import { expect, test, type Page } from '@playwright/test'

// Passo 2 del wizard (DL-005) con i magnet, sul qBittorrent finto.
const fake = 'http://localhost:18080'
const HASH = '3b1a1469c180f447b77021074dbbccaef62611e7'
const MAGNET = `magnet:?xt=urn:btih:${HASH}&dn=debian-13.1.0-amd64-DVD`

test.afterEach(async ({ request }) => {
  await request.post(`${fake}/__fake/reset`)
})

async function sendMagnet(page: Page) {
  await page.goto('/')
  const widget = page.locator('[data-slot="card"]', { hasText: 'Download' })
  await expect(widget.getByText('↓ 12,1 MB/s')).toBeVisible()
  await widget.getByRole('button', { name: 'Aggiungi' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('tab', { name: 'Link' }).click()
  await dialog.getByLabel('Link magnet o URL di un .torrent').fill(MAGNET)
  await dialog.getByRole('button', { name: 'Avanti' }).click()
  return dialog
}

test('un magnet aspetta i metadati e poi mostra i contenuti', async ({ page, request }) => {
  const dialog = await sendMagnet(page)
  await expect(dialog.getByText('Recupero dei metadati…')).toBeVisible()
  await expect(dialog.getByText('3 peer')).toBeVisible()
  await expect(dialog.getByText(`magnet · ${HASH}`)).toBeVisible()
  await expect(dialog.getByText('4 file · 7,9 GB')).toBeVisible({ timeout: 8_000 })

  // La bozza è in qBittorrent con il suo tag, ma non è un download.
  const added = await (await request.get(`${fake}/__fake/torrents`)).json()
  expect(added).toMatchObject([{ hash: HASH, tags: 'ron1nos-draft' }])
  const downloads = await (await request.get('/api/v1/downloads')).json()
  expect(downloads.torrents.map((t: { hash: string }) => t.hash)).not.toContain(HASH)
})

test('senza peer propone Riprova', async ({ page, request }) => {
  await request.post(`${fake}/__fake/state`, { data: { metadata: 'never' } })
  const dialog = await sendMagnet(page)
  await expect(dialog.getByText('Recupero dei metadati…')).toBeVisible()
  // In e2e l'attesa è di 3 secondi (METADATA_WAIT_SECONDS).
  await expect(dialog.getByText('Nessun peer ha fornito i metadati.')).toBeVisible({ timeout: 8_000 })
  await dialog.getByRole('button', { name: 'Riprova' }).click()
  await expect(dialog.getByText('Recupero dei metadati…')).toBeVisible()
})

test('un torrent già presente ferma il wizard', async ({ page, request }) => {
  await request.post(`${fake}/__fake/torrents`, {
    data: { hash: HASH, name: 'debian-13.1.0-amd64-DVD', state: 'uploading' },
  })
  const dialog = await sendMagnet(page)
  await expect(dialog.getByText('Questo torrent è già nei download.')).toBeVisible()
  await expect(dialog.getByText('debian-13.1.0-amd64-DVD · in seed')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Avanti' })).toBeDisabled()
})

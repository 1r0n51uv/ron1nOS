import { expect, test } from '@playwright/test'

import { DEBIAN_DVD } from './torrents.ts'

// Passo 1 del wizard (DL-004) sul backend vero.
test.beforeEach(async ({ page }) => {
  await page.goto('/')
  const widget = page.locator('[data-slot="card"]', { hasText: 'Download' })
  await expect(widget.getByText('↓ 12,1 MB/s')).toBeVisible()
  await widget.getByRole('button', { name: 'Aggiungi' }).click()
})

test('il selettore non filtra per tipo, così sul telefono i .torrent si scelgono', async ({ page }) => {
  await expect(page.getByRole('dialog').getByLabel('File .torrent')).not.toHaveAttribute('accept')
})

test('un file .torrent porta ai contenuti letti dal server', async ({ page }) => {
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('File .torrent').setInputFiles({
    name: 'debian-13.1.0-amd64-DVD.torrent',
    mimeType: 'application/x-bittorrent',
    buffer: DEBIAN_DVD,
  })
  await dialog.getByRole('button', { name: 'Avanti' }).click()
  await expect(dialog.getByText('AGGIUNGI TORRENT · 2 DI 4')).toBeVisible()
  await expect(dialog.getByText('debian-13.1.0-amd64-DVD', { exact: true })).toBeVisible()
  await expect(dialog.getByText('4 file · 7,9 GB')).toBeVisible()
})

test('un file che non è un torrent viene rifiutato dal server', async ({ page }) => {
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('File .torrent').setInputFiles({
    name: 'finto.torrent',
    mimeType: 'application/x-bittorrent',
    buffer: Buffer.from('non sono un torrent'),
  })
  await dialog.getByRole('button', { name: 'Avanti' }).click()
  await expect(dialog.getByText('File torrent non valido.')).toBeVisible()
  await dialog.getByRole('button', { name: 'Indietro' }).first().click()
  await expect(dialog.getByText('finto.torrent')).toBeVisible()
})

test('un URL verso un indirizzo interno non viene scaricato', async ({ page }) => {
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('tab', { name: 'Link' }).click()
  await dialog.getByLabel('Link magnet o URL di un .torrent').fill('http://127.0.0.1:18080/debian.torrent')
  await dialog.getByRole('button', { name: 'Avanti' }).click()
  await expect(dialog.getByText('Impossibile scaricare il file torrent.')).toBeVisible()
})

test('un link incollato apre la scheda Link', async ({ page }) => {
  const dialog = page.getByRole('dialog')
  // Funzione come testo: i tipi DOM non sono nel tsconfig dell'e2e.
  await page.evaluate(`(() => {
    const data = new DataTransfer()
    data.setData('text/plain', 'magnet:?xt=urn:btih:3b1a1469c180f447b77021074dbbccaef62611e7')
    const el = document.querySelector('[role="dialog"]')
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }))
  })()`)
  await expect(dialog.getByRole('tab', { name: 'Link' })).toHaveAttribute('aria-selected', 'true')
  await expect(dialog.getByText('magnet · v1')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Avanti' })).toBeEnabled()
})

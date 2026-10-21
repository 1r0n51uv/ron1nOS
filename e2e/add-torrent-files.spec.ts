import { expect, test } from '@playwright/test'

import { DEBIAN_DVD } from './torrents.ts'

// Passo 3 del wizard (DL-006): albero dei file e selezione.
test('si scelgono i file da scaricare', async ({ page }) => {
  await page.goto('/')
  const widget = page.locator('[data-slot="card"]', { hasText: 'Download' })
  await widget.getByRole('button', { name: 'Aggiungi' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('File .torrent').setInputFiles({
    name: 'debian.torrent',
    mimeType: 'application/x-bittorrent',
    buffer: DEBIAN_DVD,
  })
  await dialog.getByRole('button', { name: 'Avanti' }).click()
  await expect(dialog.getByText('4 file · 7,9 GB')).toBeVisible()
  await dialog.getByRole('button', { name: 'Avanti' }).click()

  await expect(dialog.getByRole('heading', { name: 'Cosa scaricare' })).toBeVisible()
  const list = dialog.getByRole('list', { name: 'File del torrent' })
  await expect(list.getByRole('checkbox')).toHaveCount(5)
  await expect(dialog.getByText('4 file · 7,9 GB su 7,9 GB')).toBeVisible()

  await list.getByText('debian-13.1.0-amd64-DVD-2.iso').click()
  await expect(list.getByRole('checkbox', { name: 'debian-13.1.0-amd64-DVD', exact: true })).toHaveAttribute(
    'data-state',
    'indeterminate',
  )
  await expect(dialog.getByText('3 file · 3,9 GB su 7,9 GB')).toBeVisible()

  await dialog.getByRole('button', { name: 'Nessuno' }).click()
  await expect(dialog.getByRole('button', { name: 'Avanti' })).toBeDisabled()
  await dialog.getByRole('button', { name: 'Tutti' }).click()
  await expect(dialog.getByRole('button', { name: 'Avanti' })).toBeEnabled()
})

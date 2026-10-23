import { expect, test } from '@playwright/test'

import { sql } from './db.ts'

test.describe('Impostazioni › Backup configurazione (SET-011)', () => {
  test.afterEach(() => sql('delete from preferences; delete from dashboard_layouts'))

  test('il file esportato si reimporta: mostra cosa cambia e dopo la conferma lo applica', async ({
    page,
  }) => {
    await page.goto('/impostazioni/backup')
    const download = page.waitForEvent('download')
    await page.getByRole('link', { name: 'Esporta configurazione' }).click()
    const file = await download
    expect(file.suggestedFilename()).toMatch(/^ron1nos-configurazione-\d{4}-\d{2}-\d{2}\.json$/)
    const backup = JSON.parse(await (await page.request.get('/api/v1/preferences/export')).text())
    expect(backup).toMatchObject({ app: 'ron1nOS', format: 1 })

    backup.preferences.appearance.density = 'compact'
    backup.preferences.formats.energyUnit = 'kJ'
    await page.getByLabel('File di backup').setInputFiles({
      name: 'backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(backup)),
    })
    const dialog = page.getByRole('dialog', { name: 'Importare la configurazione?' })
    await expect(dialog.getByRole('listitem')).toHaveText(['Aspetto', 'Formati'])
    await dialog.getByRole('button', { name: 'Importa' }).click()
    await expect(page.getByRole('status')).toHaveText('Configurazione importata.')
    await expect(page.locator('html')).toHaveAttribute('data-density', 'compact')
    const prefs = await (await page.request.get('/api/v1/preferences')).json()
    expect(prefs.formats.energyUnit).toBe('kJ')
  })

  test('un file che non è un backup si rifiuta senza cambiare nulla', async ({ page }) => {
    await page.goto('/impostazioni/backup')
    await page.getByLabel('File di backup').setInputFiles({
      name: 'appunti.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"nota": "ciao"}'),
    })
    await expect(page.getByRole('alert')).toHaveText('Il file non è un backup di ron1nOS')
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })
})

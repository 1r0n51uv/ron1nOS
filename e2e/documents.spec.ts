import { expect, test } from '@playwright/test'

import { sql } from './db.ts'

// PNG 60×40 rosso: basta per anteprima, miniatura e copia.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAADwAAAAoCAIAAAAt2Q6oAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAXElEQVR4nO2SAQkAQRCE7J/NUB9j9njBACIiPAdzA5NmXtT2oNK0B0dhbmDSzIvaHlSa9uAozA1MmnlR24NK0x4chbmBSTMvantQadqDozA3MGnmRW0PKs0v9vgAuCd46sYUQBgAAAAASUVORK5CYII=',
  'base64',
)

test.beforeEach(async () => {
  await sql('delete from documents')
})

test('carica un passaporto, lo ritrova in griglia e ne copia il numero (DOC-002, DOC-004, DOC-005, DOC-009)', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/documenti')
  await expect(page.getByRole('heading', { name: 'Documenti', level: 1 })).toBeVisible()
  await expect(page.getByText(/Nessun documento\./)).toBeVisible()

  await page.getByRole('button', { name: 'Carica file' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Scegli i file').setInputFiles([
    { name: 'fronte.png', mimeType: 'image/png', buffer: PNG },
    { name: 'retro.png', mimeType: 'image/png', buffer: PNG },
  ])
  await expect(dialog.getByRole('list', { name: 'File scelti' }).getByRole('listitem')).toHaveCount(2)
  await expect(dialog.getByLabel('Etichetta di retro.png')).toHaveValue('retro')
  await dialog.getByRole('group', { name: 'Tipo' }).getByRole('button', { name: 'Passaporto' }).click()
  await dialog.getByRole('button', { name: 'Continua' }).click()

  await expect(dialog.getByLabel('Titolo')).toHaveValue('Passaporto')
  await dialog.getByLabel('Numero').fill('YA1234567')
  await dialog.getByLabel('Scadenza').fill('2031-03-12')
  await dialog.getByLabel('In evidenza').check()
  await dialog.getByRole('button', { name: 'Salva' }).click()

  await expect(page.getByRole('heading', { name: 'Passaporto', level: 1 })).toBeVisible()
  await expect(page.getByText('Scade il')).toContainText('12/03/2031')
  await expect(page.getByRole('region', { name: 'Allegati' }).getByText('Allegati · 2')).toBeVisible()
  await expect(page.getByRole('img', { name: 'fronte.png' })).toBeVisible()

  await page.getByRole('button', { name: 'Copia Numero' }).click()
  await expect(page.getByRole('status')).toHaveText('Copiato · Numero')
  expect(await page.evaluate('navigator.clipboard.readText()')).toBe('YA1234567')

  await page.getByRole('link', { name: 'Documenti' }).first().click()
  const pinned = page.getByRole('region', { name: 'In evidenza' })
  await expect(pinned.getByRole('link', { name: /Passaporto/ })).toBeVisible()
  await expect(pinned.getByText('Io · Passaporto')).toBeVisible()
})

test('file libero senza tipo, poi modificato ed eliminato (DOC-003, DOC-005, DOC-014)', async ({ page }) => {
  await page.goto('/documenti')
  await page.getByRole('button', { name: 'Carica file' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Scegli i file').setInputFiles({
    name: 'Contratto affitto.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n'),
  })
  await dialog.getByRole('button', { name: /File libero/ }).click()
  await dialog.getByRole('button', { name: 'Continua' }).click()
  await expect(dialog.getByLabel('Titolo')).toHaveValue('Contratto affitto')
  await dialog.getByRole('button', { name: 'Salva' }).click()

  await expect(page.getByRole('heading', { name: 'Contratto affitto', level: 1 })).toBeVisible()
  await page.getByRole('button', { name: 'Modifica' }).click()
  const edit = page.getByRole('dialog')
  await edit.getByRole('button', { name: 'Aggiungi campo' }).click()
  await edit.getByLabel('Etichetta').fill('Codice')
  await edit.getByLabel('Valore').fill('RM-2026')
  await edit.getByRole('button', { name: 'Salva' }).click()
  await expect(page.getByRole('button', { name: 'Copia Codice' })).toBeVisible()

  await page.getByRole('button', { name: 'Elimina', exact: true }).click()
  await page.getByRole('button', { name: 'Elimina davvero' }).click()
  await expect(page).toHaveURL(/\/documenti$/)
  await expect(page.getByText(/Nessun documento\./)).toBeVisible()
})

test('il widget mostra fissati e scadenze; la stella fissa dalla pagina (DOC-001, DOC-008, DOC-010)', async ({
  page,
  request,
}) => {
  const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10)
  await request.post('/api/v1/documents/documents', {
    data: { title: 'Patente', holder: 'Mario', expiresOn: day(-5) },
  })
  await request.post('/api/v1/documents/documents', { data: { title: 'Polizza auto', expiresOn: day(400) } })

  await page.goto('/documenti')
  await page.getByRole('button', { name: 'Metti in evidenza Polizza auto' }).click()
  await expect(
    page.getByRole('region', { name: 'In evidenza' }).getByRole('link', { name: /Polizza auto/ }),
  ).toBeVisible()

  await page.goto('/')
  const widget = page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByText('Documenti', { exact: true }) })
  await expect(widget.getByRole('list', { name: 'In evidenza' })).toHaveText('Polizza auto')
  await expect(widget.getByRole('list', { name: 'In scadenza' })).toContainText('Patente · Mario')
  await expect(widget.getByRole('list', { name: 'In scadenza' })).toContainText('Scaduto')
  await widget.getByRole('link', { name: 'Polizza auto' }).click()
  await expect(page.getByRole('heading', { name: 'Polizza auto', level: 1 })).toBeVisible()
})

test('tipo personalizzato: si crea, si usa e un campo tolto diventa campo libero (DOC-016)', async ({
  page,
  request,
}) => {
  await sql('delete from document_types where key is null')
  await page.goto('/documenti')
  await page.getByRole('link', { name: 'Tipi' }).click()
  await expect(page.getByRole('heading', { name: 'Tipi di documento', level: 1 })).toBeVisible()
  await page.getByRole('button', { name: 'Nuovo tipo' }).click()
  await expect(page.getByRole('region', { name: 'Nuovo tipo' })).toBeVisible()
  await page.getByLabel('Nome', { exact: true }).fill('Polizza')
  await page.getByLabel('Etichetta del campo 1').fill('Targa')
  await page.getByLabel('Tipo del campo Targa').selectOption('code')
  await page.getByRole('button', { name: 'Salva' }).click()
  const nav = page.getByRole('navigation', { name: 'Tipi' })
  await expect(nav.getByRole('button', { name: /Polizza/ })).toHaveAttribute('aria-current', 'true')

  const types = (await (await request.get('/api/v1/documents/types')).json()) as {
    id: string
    name: string
  }[]
  const polizza = types.find((t) => t.name === 'Polizza')!
  const created = await request.post('/api/v1/documents/documents', {
    data: { typeId: polizza.id, title: 'Polizza auto', fields: { targa: 'AB123CD' } },
  })
  const doc = (await created.json()) as { id: string }

  await page.reload()
  await expect(page.getByText(/Usato da 1 documento/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Elimina tipo' })).toBeDisabled()
  await page.getByRole('button', { name: 'Togli Targa' }).click()
  await page.getByRole('button', { name: 'Salva' }).click()
  await expect(page.getByRole('button', { name: 'Togli Targa' })).toHaveCount(0)

  await page.goto(`/documenti/${doc.id}`)
  await expect(page.getByRole('button', { name: 'Copia Targa' })).toBeVisible()
  await expect(page.getByText('AB123CD')).toBeVisible()
  await sql('delete from documents')
  await sql('delete from document_types where key is null')
})

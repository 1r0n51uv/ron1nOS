import { expect, test } from '@playwright/test'

import { sql } from './db.ts'

test.describe('preferenze sul server (SET-002)', () => {
  test.afterEach(() => sql('delete from preferences'))

  test('una modifica parziale si salva e si rilegge', async ({ page }) => {
    const saved = await page.request.patch('/api/v1/preferences', {
      data: { appearance: { density: 'compact' }, formats: { weightUnit: 'lb' } },
    })
    expect(saved.status()).toBe(200)
    const body = await (await page.request.get('/api/v1/preferences')).json()
    expect(body).toMatchObject({
      appearance: { background: 'brace', glass: 'medium', density: 'compact' },
      formats: { timeZone: 'Europe/Rome', weightUnit: 'lb', energyUnit: 'kcal' },
      stored: true,
    })
  })

  test('valori non previsti danno 400 e non cambiano nulla', async ({ page }) => {
    const res = await page.request.patch('/api/v1/preferences', { data: { appearance: { glass: 'opaco' } } })
    expect(res.status()).toBe(400)
    const body = await (await page.request.get('/api/v1/preferences')).json()
    expect(body.updatedAt).toBeNull()
  })

  test('con il database le impostazioni non mostrano l’avviso', async ({ page }) => {
    await page.goto('/impostazioni')
    await expect(page.getByRole('heading', { level: 1, name: 'Impostazioni' })).toBeVisible()
    await expect(page.getByText('Preferenze predefinite')).toHaveCount(0)
    // La copia letta all'avvio resta nel browser per il prossimo caricamento.
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('ron1nos.preferences')))
      .toContain('"stored":true')
  })
})

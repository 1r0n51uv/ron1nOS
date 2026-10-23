import { expect, test } from '@playwright/test'

import { FAKE_CLIENT, FAKE_USER } from '../server/testing/fake-yazio.ts'

test.describe('Impostazioni › Integrazioni (SET-009)', () => {
  test('una riga per servizio, Verifica rifà il controllo', async ({ page }) => {
    await page.goto('/impostazioni/integrazioni')
    const list = page.getByRole('list', { name: 'Servizi esterni' })
    await expect(list.getByRole('listitem')).toHaveCount(5)
    await expect(list.getByRole('listitem', { name: 'Postgres' })).toContainText('collegato')
    await expect(list.getByRole('listitem', { name: 'qBittorrent' })).toContainText('collegato')
    await expect(list.getByRole('listitem', { name: 'Home Assistant' })).toContainText('non configurato')

    const verify = page.waitForResponse((r) => r.url().endsWith('/api/v1/integrations/glances/check'))
    await page.getByRole('button', { name: 'Verifica · Glances' }).click()
    expect((await verify).status()).toBe(200)
    await expect(list.getByRole('listitem', { name: 'Glances' })).toContainText('collegato')
  })

  test('l’API non restituisce mai password, token o indirizzi', async ({ page }) => {
    const body = await (await page.request.get('/api/v1/integrations')).text()
    for (const secret of [FAKE_USER.password, FAKE_CLIENT.secret, 'chiave-e2e', 'localhost', 'admin']) {
      expect(body).not.toContain(secret)
    }
  })
})

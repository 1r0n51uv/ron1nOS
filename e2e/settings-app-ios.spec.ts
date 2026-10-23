import { expect, test } from '@playwright/test'

import { sql } from './db.ts'

test.describe('Impostazioni › App iOS (SET-008, AUTH-005)', () => {
  // I token di un giro precedente non devono contare.
  test.beforeEach(() => sql("delete from auth_tokens where name like 'e2e %'"))

  test("crea un token, l'API lo accetta, revocato non vale più", async ({ page, playwright, baseURL }) => {
    await page.goto('/impostazioni/app-ios')
    await expect(page.getByRole('heading', { level: 2, name: 'App iOS' })).toBeVisible()
    await page.getByLabel('Nome').fill('e2e iPhone')
    await page.getByRole('button', { name: 'Crea token' }).click()
    const token = (await page.getByLabel('Token appena creato').textContent()) ?? ''
    expect(token).toMatch(/^r1n_/)
    const list = page.getByRole('list', { name: 'Token attivi' })
    await expect(list.getByRole('listitem', { name: 'e2e iPhone' })).toHaveCount(1)

    // Un client senza cookie, come l'app.
    const app = await playwright.request.newContext({
      baseURL,
      storageState: { cookies: [], origins: [] },
      extraHTTPHeaders: { authorization: `Bearer ${token}` },
    })
    expect((await app.get('/api/v1/auth/me')).status()).toBe(200)

    await page.getByRole('button', { name: 'Revoca · e2e iPhone' }).click()
    await expect(list.getByRole('listitem', { name: 'e2e iPhone' })).toHaveCount(0)
    expect((await app.get('/api/v1/auth/me')).status()).toBe(401)
    await app.dispose()
  })
})

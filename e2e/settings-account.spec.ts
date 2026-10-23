import { createHash } from 'node:crypto'

import { expect, test } from '@playwright/test'

import { sql } from './db.ts'

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'

// Una sessione di un altro dispositivo, scritta direttamente in Postgres.
async function otherSession(tag: string) {
  const hash = createHash('sha256').update(`e2e-${tag}-${Date.now()}`).digest('hex')
  await sql(
    `insert into auth_sessions (token_hash, expires_at, user_agent)
     values ($1, now() + interval '1 day', $2)`,
    [hash, IPHONE],
  )
}

test.describe('Impostazioni › Account (SET-007)', () => {
  // Le sessioni finte di un giro precedente non devono contare.
  test.beforeEach(() => sql('delete from auth_sessions where user_agent = $1', [IPHONE]))
  test('sessioni attive: si chiude quella di un altro dispositivo', async ({ page }) => {
    await otherSession('uno')
    await page.goto('/impostazioni/account')
    const list = page.getByRole('list', { name: 'Sessioni attive' })
    await expect(list.getByText('questo browser')).toBeVisible()
    const iphone = list.getByRole('listitem', { name: 'Safari su iPhone' })
    await expect(iphone).toHaveCount(1)
    await page.getByRole('button', { name: 'Chiudi · Safari su iPhone' }).click()
    await expect(iphone).toHaveCount(0)
    await expect(page.getByText('npm run auth:hash')).toBeVisible()
  })

  test('Chiudi le altre sessioni lascia aperta solo questa', async ({ page }) => {
    await otherSession('due')
    await otherSession('tre')
    await page.goto('/impostazioni/account')
    await page.getByRole('button', { name: 'Chiudi le altre sessioni' }).click()
    const list = page.getByRole('list', { name: 'Sessioni attive' })
    await expect(list.getByRole('listitem')).toHaveCount(1)
    await expect(list.getByText('questo browser')).toBeVisible()
    // Questa sessione funziona ancora.
    expect((await page.request.get('/api/v1/auth/me')).status()).toBe(200)
  })
})

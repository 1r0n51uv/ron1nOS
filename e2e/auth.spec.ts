import { expect, test } from '@playwright/test'

import { E2E_PASSWORD } from './auth.ts'

// Senza il cookie salvato dal setup: un browser che non è mai entrato.
test.use({ storageState: { cookies: [], origins: [] } })

test('senza sessione si va al login e poi si torna alla pagina richiesta', async ({ page }) => {
  await page.goto('/pasti')
  await expect(page).toHaveURL(/\/login\?next=%2Fpasti$/)
  await expect(page.getByRole('heading', { name: 'ron1nOS' })).toBeVisible()

  await page.getByLabel('Password').fill('sbagliata')
  await page.getByRole('button', { name: 'Accedi' }).click()
  await expect(page.getByRole('alert')).toHaveText('Password non valida')

  await page.getByLabel('Password').fill(E2E_PASSWORD)
  await page.getByRole('button', { name: 'Accedi' }).click()
  await expect(page).toHaveURL(/\/pasti$/)
})

test('Esci in Impostazioni chiude la sessione', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Password').fill(E2E_PASSWORD)
  await page.getByRole('button', { name: 'Accedi' }).click()
  await expect(page).toHaveURL(/\/$/)

  await page.goto('/impostazioni')
  await page
    .getByRole('region', { name: 'Accesso' })
    .getByRole('button', { name: 'Esci', exact: true })
    .click()
  await expect(page).toHaveURL(/\/login$/)
  await page.goto('/impostazioni')
  await expect(page).toHaveURL(/\/login\?next=%2Fimpostazioni$/)
})

test('API senza sessione: 401, health sì', async ({ request }) => {
  expect((await request.get('/api/v1/health')).ok()).toBe(true)
  const res = await request.get('/api/v1/downloads')
  expect(res.status()).toBe(401)
  expect(await res.json()).toMatchObject({ error: 'unauthenticated' })
})

test('dopo 5 password sbagliate il login si blocca per 15 minuti', async ({ playwright, baseURL }) => {
  // Un indirizzo tutto suo, per non bloccare gli altri test.
  const request = await playwright.request.newContext({
    baseURL,
    extraHTTPHeaders: { 'x-forwarded-for': '198.51.100.7' },
  })
  for (let i = 0; i < 5; i++) {
    expect((await request.post('/api/v1/auth/login', { data: { password: 'no' } })).status()).toBe(401)
  }
  const blocked = await request.post('/api/v1/auth/login', { data: { password: E2E_PASSWORD } })
  expect(blocked.status()).toBe(429)
  expect(await blocked.json()).toMatchObject({ message: 'Troppi tentativi. Riprova tra 15 minuti.' })
  await request.dispose()
})

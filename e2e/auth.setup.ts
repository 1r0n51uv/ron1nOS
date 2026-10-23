import { expect, test as setup } from '@playwright/test'

import { E2E_PASSWORD, STATE } from './auth.ts'

setup('login una volta per tutta la suite', async ({ request }) => {
  // Le migrazioni (tabella delle sessioni) partono all'avvio del backend.
  await expect.poll(async () => (await (await request.get('/api/v1/health')).json()).database).toBe('ok')
  const res = await request.post('/api/v1/auth/login', { data: { password: E2E_PASSWORD } })
  expect(res.ok()).toBe(true)
  await request.storageState({ path: STATE })
})

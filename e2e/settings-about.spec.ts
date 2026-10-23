import { expect, test } from '@playwright/test'

test('Impostazioni › Informazioni mostra versione, stato e link (SET-012)', async ({ page }) => {
  await page.goto('/impostazioni/informazioni')
  await expect(page.getByRole('heading', { name: 'Informazioni' })).toBeVisible()
  // Il backend dei test non gira in un'immagine: niente commit.
  await expect(page.getByText('build locale')).toBeVisible()
  await expect(page.getByText('attivo', { exact: true })).toBeVisible()
  await expect(page.getByText('collegato', { exact: true })).toBeVisible()
  await expect(page.getByText(/^\d+ (min|h \d+ min|g \d+ h)$/)).toBeVisible()
  await expect(page.getByRole('link', { name: 'Repository di ron1nOS' })).toHaveAttribute(
    'href',
    'https://github.com/1r0n51uv/ron1nOS',
  )

  const about = await (await page.request.get('/api/v1/about')).json()
  expect(about.version).toEqual({ commit: null, builtAt: null })
  expect(about.uptimeSeconds).toBeGreaterThanOrEqual(0)
})

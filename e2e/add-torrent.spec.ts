import { expect, test, type Page } from '@playwright/test'

// Pulsante Aggiungi e guscio del wizard (DL-003).
test.beforeEach(async ({ page }) => {
  await page.goto('/')
  const widget = page.locator('[data-slot="card"]', { hasText: 'Download' })
  await expect(widget.getByText('↓ 12,1 MB/s')).toBeVisible()
  await widget.getByRole('button', { name: 'Aggiungi' }).click()
})

test('Aggiungi apre il wizard sopra la dashboard', async ({ page }) => {
  const dialog = page.getByRole('dialog', { name: 'Da dove arriva il torrent' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('AGGIUNGI TORRENT · 1 DI 4')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Avanti' })).toBeDisabled()
  // La dashboard resta sotto il vetro.
  await expect(page.locator('[data-slot="card"]', { hasText: 'Download' })).toBeAttached()
})

const closers: [string, (page: Page) => Promise<void>][] = [
  ['Esc', (page) => page.keyboard.press('Escape')],
  ['Annulla', (page) => page.getByRole('dialog').getByRole('button', { name: 'Annulla' }).click()],
  ['Chiudi', (page) => page.getByRole('dialog').getByRole('button', { name: 'Chiudi' }).click()],
]

for (const [how, close] of closers) {
  test(`il wizard si chiude con ${how}`, async ({ page }) => {
    await expect(page.getByRole('dialog')).toBeVisible()
    await close(page)
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Aggiungi' })).toBeFocused()
  })
}

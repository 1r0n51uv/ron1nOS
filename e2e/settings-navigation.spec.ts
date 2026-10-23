import { expect, test } from '@playwright/test'

import { sql } from './db.ts'

test.describe('Impostazioni › Navigazione (SET-006)', () => {
  test.afterEach(() => sql('delete from preferences'))

  test('le frecce riordinano la barra, l’ordine resta dopo il ricaricamento e si ripristina', async ({
    page,
  }) => {
    await page.goto('/impostazioni/navigazione')
    const rail = page.getByRole('navigation', { name: 'Sezioni', exact: true })
    const railLabels = () =>
      rail.getByRole('link').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))

    await page.getByRole('button', { name: 'Sposta su · Server e container' }).click()
    await page.getByRole('button', { name: 'Sposta su · Server e container' }).click()
    await expect
      .poll(railLabels)
      .toEqual([
        'ron1nOS, dashboard',
        'Dashboard',
        'Pasti',
        'Allenamenti',
        'Documenti',
        'Server e container',
        'Note',
        'Casa',
        'Impostazioni',
      ])

    await page.reload()
    await expect.poll(async () => (await railLabels()).indexOf('Server e container')).toBe(5)

    await page.getByRole('button', { name: 'Ripristina ordine' }).click()
    await expect(page.getByRole('button', { name: 'Ripristina ordine' })).toBeDisabled()
    await expect.poll(async () => (await railLabels()).at(-2)).toBe('Server e container')
  })

  test('trascinare una voce la sposta', async ({ page }) => {
    await page.goto('/impostazioni/navigazione')
    const list = page.getByRole('list', { name: 'Voci della barra' })
    await list.getByRole('listitem', { name: 'Casa' }).dragTo(list.getByRole('listitem', { name: 'Pasti' }))
    await expect(list.getByRole('listitem').nth(1)).toHaveAttribute('aria-label', 'Casa')
    await expect(list.getByRole('listitem').first()).toHaveAttribute('aria-label', 'Dashboard')
    await expect(list.getByRole('listitem').last()).toHaveAttribute('aria-label', 'Impostazioni')
  })
})

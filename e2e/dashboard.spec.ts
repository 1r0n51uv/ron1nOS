import { expect, test } from '@playwright/test'

import { sql } from './db.ts'

const widgets = [
  'Nutrizione',
  'Allenamento',
  'Peso',
  'Casa',
  'Server',
  'Container',
  'Download',
  'Nota fissata',
]

test('la dashboard mostra tutti i widget con i dati', async ({ page }) => {
  await page.goto('/')
  for (const title of widgets) {
    await expect(page.getByText(title, { exact: true }).first()).toBeVisible()
  }
  // Finito il caricamento non restano skeleton.
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0)
})

test('la navigazione porta alle sezioni e segna la voce attiva', async ({ page }) => {
  await page.goto('/')
  const nav = page.getByRole('navigation', { name: 'Sezioni' })
  await nav.getByRole('link', { name: 'Pasti' }).click()
  await expect(page).toHaveURL(/\/pasti$/)
  await expect(nav.getByRole('link', { name: 'Pasti' })).toHaveAttribute('aria-current', 'page')
  await nav.getByRole('link', { name: 'ron1nOS, dashboard' }).click()
  await expect(page).toHaveURL(/\/$/)
})

test('una rotta sconosciuta mostra la pagina non trovata', async ({ page }) => {
  await page.goto('/non-esiste')
  await expect(page.getByText('Pagina non trovata')).toBeVisible()
})

test('i widget compaiono nell’ordine del catalogo', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0)
  const titles = page.locator('main [data-slot="card-title"]')
  await expect(titles).toHaveText(widgets)
})

test.describe('layout salvato sul server (DASH-007)', () => {
  test.afterEach(() => sql('delete from dashboard_layouts'))

  test('decide quali widget compaiono e in che ordine', async ({ page }) => {
    const res = await page.request.put('/api/v1/dashboard/layouts/desktop', {
      data: {
        header: 'full',
        items: [
          { id: 'notes.summary', x: 0, y: 0, w: 8, h: 6 },
          { id: 'server.summary', x: 8, y: 0, w: 8, h: 8 },
        ],
      },
    })
    expect(res.status()).toBe(200)
    await page.goto('/')
    await expect(page.locator('main [data-slot="card-title"]')).toHaveText(['Nota fissata', 'Server'])
  })

  test('un layout che non rispetta il catalogo viene rifiutato', async ({ page }) => {
    const res = await page.request.put('/api/v1/dashboard/layouts/desktop', {
      data: { header: 'full', items: [{ id: 'server.summary', x: 20, y: 0, w: 8, h: 8 }] },
    })
    expect(res.status()).toBe(422)
    expect((await res.json()).error).toBe('invalid_layout')
  })
})

test.describe('griglia libera (DASH-003)', () => {
  test.afterEach(() => sql('delete from dashboard_layouts'))

  test('i widget stanno dove sono salvati e gli spazi vuoti restano', async ({ page }) => {
    await page.request.put('/api/v1/dashboard/layouts/desktop', {
      data: {
        header: 'full',
        items: [
          { id: 'notes.summary', x: 16, y: 0, w: 8, h: 7 },
          { id: 'weight.summary', x: 0, y: 20, w: 12, h: 7 },
        ],
      },
    })
    await page.goto('/')
    const notes = await page.locator('[data-widget="notes.summary"]').boundingBox()
    const weight = await page.locator('[data-widget="weight.summary"]').boundingBox()
    const grid = await page.getByTestId('dashboard-grid').boundingBox()
    if (!notes || !weight || !grid) throw new Error('widget non trovati')
    // Note a destra in alto, peso a sinistra 20 righe più in basso (40px l'una).
    expect(notes.x).toBeGreaterThan(grid.x + grid.width / 2)
    expect(Math.round(weight.y - grid.y)).toBe(20 * 40)
    expect(weight.width).toBeGreaterThan(notes.width)
  })
})

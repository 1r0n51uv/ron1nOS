import { expect, test, type Page } from '@playwright/test'

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
  'Documenti',
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

test.describe('modifica sempre attiva (DASH-004)', () => {
  test.afterEach(() => sql('delete from dashboard_layouts'))

  const two = {
    header: 'full',
    items: [
      { id: 'notes.summary', x: 0, y: 0, w: 8, h: 7 },
      { id: 'weight.summary', x: 8, y: 0, w: 8, h: 7 },
    ],
  }

  async function saved(page: Page) {
    const res = await page.request.get('/api/v1/dashboard/layouts/desktop')
    return ((await res.json()) as { items: { id: string; x: number; y: number; w: number; h: number }[] })
      .items
  }

  test('si trascina dalla maniglia, si ridimensiona dall’angolo e si salva', async ({ page }) => {
    await page.request.put('/api/v1/dashboard/layouts/desktop', { data: two })
    await page.goto('/')
    const notes = page.locator('[data-widget="notes.summary"]')
    await notes.hover()
    const handle = page.getByRole('button', { name: 'Sposta il widget Nota fissata' })
    await expect(handle).toBeVisible()
    const box = await handle.boundingBox()
    if (!box) throw new Error('maniglia non trovata')
    // Tre righe più in basso (40px l'una).
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 60, { steps: 4 })
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 120, { steps: 4 })
    await page.mouse.up()
    await expect(notes).toHaveCSS('grid-row-start', '4')

    await notes.hover()
    const corner = await page
      .getByRole('button', { name: 'Ridimensiona il widget Nota fissata' })
      .boundingBox()
    if (!corner) throw new Error('angolo non trovato')
    await page.mouse.move(corner.x + 10, corner.y + 10)
    await page.mouse.down()
    // Molto oltre il massimo: si ferma a 16 colonne.
    await page.mouse.move(corner.x + 900, corner.y + 10, { steps: 6 })
    await page.mouse.up()

    await expect
      .poll(() => saved(page))
      .toEqual([
        { id: 'notes.summary', x: 0, y: 3, w: 16, h: 7 },
        // Allargandosi le note coprono il peso, che scende sotto.
        { id: 'weight.summary', x: 8, y: 10, w: 8, h: 7 },
      ])
  })

  test('Rimuovi toglie il widget e Annulla lo rimette', async ({ page }) => {
    await page.request.put('/api/v1/dashboard/layouts/desktop', { data: two })
    await page.goto('/')
    await page.locator('[data-widget="weight.summary"]').hover()
    await page.getByRole('button', { name: 'Altre azioni sul widget Peso' }).click()
    await page.getByRole('menuitem', { name: 'Rimuovi' }).click()
    await expect(page.locator('[data-widget="weight.summary"]')).toHaveCount(0)
    const toast = page.getByRole('status').filter({ hasText: 'Widget Peso rimosso' })
    await expect(toast).toBeVisible()
    await toast.getByRole('button', { name: 'Annulla' }).click()
    await expect(page.locator('[data-widget="weight.summary"]')).toBeVisible()
    await expect.poll(() => saved(page)).toEqual(two.items)
  })

  test('da tastiera si sposta e si rimuove; dal catalogo si aggiunge', async ({ page }) => {
    await page.request.put('/api/v1/dashboard/layouts/desktop', { data: two })
    await page.goto('/')
    const handle = page.getByRole('button', { name: 'Sposta il widget Peso' })
    await handle.focus()
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await expect(handle).toBeFocused()
    await expect(page.locator('[data-widget="weight.summary"]')).toHaveCSS('grid-column-start', '11')
    await page.keyboard.press('Delete')
    await expect(page.locator('[data-widget="weight.summary"]')).toHaveCount(0)

    await page.getByRole('button', { name: 'Aggiungi widget' }).click()
    const dialog = page.getByRole('dialog', { name: 'Aggiungi widget' })
    const weight = dialog.getByRole('article', { name: 'Peso' })
    await weight.getByRole('button', { name: 'Aggiungi' }).click()
    await expect(dialog).toBeHidden()
    // Rientra nel primo spazio libero in alto, alla dimensione predefinita.
    await expect
      .poll(() => saved(page))
      .toEqual([two.items[0], { id: 'weight.summary', x: 8, y: 0, w: 8, h: 7 }])
  })
})

test.describe('opzioni del widget (DASH-005)', () => {
  test.afterEach(() => sql('delete from dashboard_layouts'))

  test('variante e dati mostrati si scelgono dal menu e si salvano', async ({ page }) => {
    await page.request.put('/api/v1/dashboard/layouts/desktop', {
      data: {
        header: 'full',
        items: [
          { id: 'weight.summary', x: 0, y: 0, w: 8, h: 7 },
          { id: 'nutrition.summary', x: 8, y: 0, w: 8, h: 10 },
        ],
      },
    })
    await page.goto('/')
    const weight = page.locator('[data-widget="weight.summary"]')
    await expect(weight.getByRole('img', { name: /Peso da/ })).toBeVisible()
    await weight.hover()
    await page.getByRole('button', { name: 'Altre azioni sul widget Peso' }).click()
    await page.getByRole('menuitem', { name: 'Opzioni' }).click()
    const dialog = page.getByRole('dialog', { name: 'Opzioni · Peso' })
    await dialog.getByRole('radio', { name: 'Compatta' }).click()
    await dialog.getByRole('button', { name: 'Fatto' }).click()
    await expect(weight.getByRole('img', { name: /Peso da/ })).toHaveCount(0)

    const nutrition = page.locator('[data-widget="nutrition.summary"]')
    await nutrition.hover()
    await page.getByRole('button', { name: 'Altre azioni sul widget Nutrizione' }).click()
    await page.getByRole('menuitem', { name: 'Opzioni' }).click()
    await page.getByRole('dialog').getByRole('checkbox', { name: 'Grassi' }).click()
    await page.keyboard.press('Escape')
    await expect(nutrition.getByText('Grassi')).toHaveCount(0)
    await expect(nutrition.getByText('Proteine')).toBeVisible()

    await expect
      .poll(async () => {
        const res = await page.request.get('/api/v1/dashboard/layouts/desktop')
        return ((await res.json()) as { items: unknown[] }).items
      })
      .toEqual([
        { id: 'weight.summary', x: 0, y: 0, w: 8, h: 7, variant: 'compact' },
        { id: 'nutrition.summary', x: 8, y: 0, w: 8, h: 10, options: { macros: ['protein', 'carbs'] } },
      ])
  })
})

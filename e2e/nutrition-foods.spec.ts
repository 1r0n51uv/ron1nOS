import type { Locator } from '@playwright/test'
import { expect, test } from '@playwright/test'

import { resetNutrition } from './db.ts'

test.beforeEach(async () => {
  await resetNutrition()
})

async function fill(scope: Locator, values: Record<string, string>) {
  for (const [label, value] of Object.entries(values)) {
    await scope.getByLabel(new RegExp(`^${label}`)).fill(value)
  }
}

test('un alimento personale si crea, si usa, si modifica e si elimina (NUT-006)', async ({ page }) => {
  await page.goto('/impostazioni/moduli/nutrizione')
  await page.getByRole('button', { name: 'Nuovo alimento' }).click()
  const form = page.getByRole('form', { name: 'Alimento personale' })
  await fill(form, {
    Nome: 'Granola della casa',
    Calorie: '450',
    Proteine: '10',
    Carboidrati: '60',
    Grassi: '18',
  })
  await form.getByRole('button', { name: 'Crea' }).click()
  const row = page.getByRole('listitem', { name: 'Granola della casa' })
  await expect(row.getByText('450 kcal · P 10,0 · C 60,0 · G 18,0')).toBeVisible()

  // Si registra a colazione dalla ricerca.
  await page.goto('/pasti')
  await page.getByRole('button', { name: 'Registra in Colazione' }).click()
  const dialog = page.getByRole('dialog', { name: 'Cosa hai mangiato' })
  await dialog.getByLabel('Cerca un alimento').fill('granola')
  await dialog.getByRole('button', { name: /Granola della casa/ }).click()
  await dialog.getByLabel('Quantità in grammi').fill('50')
  await dialog.getByRole('button', { name: 'Aggiungi' }).click()
  await dialog.getByRole('button', { name: 'Registra' }).click()
  const breakfast = page.getByRole('article', { name: 'Colazione' })
  await expect(breakfast.getByText('225 kcal').first()).toBeVisible()

  // Modificato ed eliminato, il pasto resta com'era.
  await page.goto('/impostazioni/moduli/nutrizione')
  await row.getByRole('button', { name: 'Modifica' }).click()
  await fill(page.getByRole('form', { name: 'Alimento personale' }), { Calorie: '400' })
  await page.getByRole('button', { name: 'Salva' }).last().click()
  await expect(row.getByText(/^400 kcal/)).toBeVisible()
  await row.getByRole('button', { name: 'Elimina' }).click()
  await row.getByRole('button', { name: 'Elimina davvero' }).click()
  await expect(page.getByText('Nessun alimento personale.')).toBeVisible()

  await page.goto('/pasti')
  await expect(breakfast.getByText('Granola della casa')).toBeVisible()
  await expect(breakfast.getByText('225 kcal').first()).toBeVisible()
})

test('dal modale si crea un alimento nuovo e lo si sceglie', async ({ page }) => {
  await page.goto('/pasti')
  await page.getByRole('button', { name: 'Registra in Cena' }).click()
  const dialog = page.getByRole('dialog', { name: 'Cosa hai mangiato' })
  await dialog.getByLabel('Cerca un alimento').fill('Polpette della nonna')
  await dialog.getByRole('tab', { name: 'Nuovo alimento' }).click()
  const form = dialog.getByRole('form', { name: 'Alimento personale' })
  await expect(form.getByLabel('Nome')).toHaveValue('Polpette della nonna')
  await fill(form, { Calorie: '220', Proteine: '15', Carboidrati: '8', Grassi: '14', Porzione: '150' })
  await form.getByRole('button', { name: 'Crea e scegli' }).click()
  await expect(dialog.getByLabel('Quantità in grammi')).toHaveValue('150')
  await dialog.getByRole('button', { name: 'Aggiungi' }).click()
  await dialog.getByRole('button', { name: 'Registra' }).click()
  await expect(page.getByRole('article', { name: 'Cena' }).getByText('Polpette della nonna')).toBeVisible()
})

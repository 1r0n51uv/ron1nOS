import { expect, test } from '@playwright/test'

// DES-004: link e pulsanti di testo nelle card hanno un'area di almeno 28px.
const MIN = 28

for (const route of ['/', '/allenamenti', '/pasti']) {
  test(`le aree cliccabili delle card in ${route} sono almeno ${MIN}px`, async ({ page }) => {
    await page.goto(route)
    await expect(page.locator('[data-slot=card]').first()).toBeVisible()
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0)

    const small = await page
      .locator('[data-slot=card] a, [data-slot=card] button')
      .evaluateAll((els) =>
        els
          .map((el) => ({
            name: (el.textContent ?? '').trim().slice(0, 30),
            h: el.getBoundingClientRect().height,
          }))
          .filter((c) => c.name && c.h > 0 && c.h < 28),
      )
    expect(small).toEqual([])
  })
}

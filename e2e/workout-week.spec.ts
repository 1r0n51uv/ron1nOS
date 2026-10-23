import { expect, test } from '@playwright/test'

import { dayFromToday, resetNutrition, sql } from './db.ts'

test.beforeEach(async () => {
  await resetNutrition()
})

async function seed(day: string, routine: string) {
  await sql(
    `insert into workout_sessions (day, routine, started_at) values ($1::date, $2, ($1::text || ' 18:00')::timestamp)`,
    [day, routine],
  )
}

test('la pagina mostra la settimana, i giorni di fila e le ultime 26 settimane (GYM-013)', async ({
  page,
}) => {
  await page.goto('/allenamenti')
  await expect(
    page.getByText('Importa il CSV esportato da Liftin’ per vedere qui i tuoi allenamenti.'),
  ).toBeVisible()

  await seed(dayFromToday(0), 'Push')
  await seed(dayFromToday(-56), 'Gambe')
  await seed(dayFromToday(-57), 'Pull')
  await page.reload()

  await expect(page.getByText('1 allenamento questa settimana · 1 giorno di fila')).toBeVisible()
  const chart = page.getByRole('img', { name: /^Allenamenti per settimana dal / })
  await expect(chart).toHaveAttribute('aria-label', /questa settimana 1 allenamento, media 0,1$/)
  await expect(page.getByText('media 0,1 a settimana')).toBeVisible()
})

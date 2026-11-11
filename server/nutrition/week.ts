// La settimana (NUT-032): per ogni giorno, i pasti con la ricetta
// programmata e il loro stato, più i totali del giorno. Basta per la griglia
// dei client; il dettaglio di un giorno resta `GET /day`.
import type { Queryable } from '../db.ts'
import { addDays, weekday } from './dates.ts'
import type { Day, Macros } from './day.ts'
import { getDay } from './day.ts'
import { InvalidRequestError } from './http.ts'
import type { Slot } from './schemas.ts'

export type WeekSlot = {
  slot: Slot
  state: 'empty' | 'planned' | 'eaten' | 'skipped'
  // Kcal del pasto mangiato, o di quello pianificato; 0 se vuoto.
  kcal: number
  plan: { id: string; status: 'planned' | 'eaten' | 'skipped'; recipeId: string | null; name: string } | null
}

export type WeekDay = {
  date: string
  quota: Day['quota']
  totals: Macros
  plannedKcal: number
  slots: WeekSlot[]
}

export type Week = { from: string; days: WeekDay[] }

export async function getWeek(db: Queryable, from: string): Promise<Week> {
  if (weekday(from) !== 1) throw new InvalidRequestError('La settimana parte da lunedì')
  const days = await Promise.all([0, 1, 2, 3, 4, 5, 6].map((n) => getDay(db, addDays(from, n))))
  return {
    from,
    days: days.map((d) => ({
      date: d.date,
      quota: d.quota,
      totals: d.totals,
      plannedKcal: d.plannedKcal,
      slots: d.slots.map((s): WeekSlot => {
        const p = s.planned
        return {
          slot: s.slot,
          state: s.state,
          kcal: s.meal?.kcal ?? p?.kcal ?? 0,
          plan: p
            ? {
                id: p.id,
                status: p.status,
                recipeId: p.recipeId,
                name: p.recipeName ?? p.items[0]?.name ?? '',
              }
            : null,
        }
      }),
    })),
  }
}

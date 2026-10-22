// Andamento (NUT-017), dal DietReport di 1r0-pkm portato nel backend: serie
// giornaliera di kcal e macro, media, tendenza, aderenza e peso, così web e
// iOS mostrano gli stessi numeri.
import type { Queryable } from '../db.ts'
import { addDays } from './dates.ts'
import { goalsBetween } from './goals.ts'
import { quotaFor } from './quota.ts'

export const REPORT_DAYS = [30, 90] as const
export const ADHERENCE_KCAL = 150

export type ReportDay = {
  date: string
  kcal: number
  protein: number
  carbs: number
  fat: number
  // C'è almeno una riga quel giorno: i giorni vuoti non contano nelle medie.
  logged: boolean
  // La quota del giorno (NUT-016), se c'era un obiettivo.
  goalKcal: number | null
}

export type Report = {
  days: number
  from: string
  to: string
  series: ReportDay[]
  averageKcal: number | null
  // kcal in più o in meno a settimana, dalla retta dei giorni registrati.
  trendKcalPerWeek: number | null
  adherence: { inTarget: number; total: number; pct: number | null }
  macros: { protein: number; carbs: number; fat: number } | null
  goal: { protein: number; carbs: number; fat: number } | null
  weight: {
    points: { date: string; kg: number }[]
    first: number | null
    last: number | null
    delta: number | null
  }
}

const round1 = (n: number) => Math.round(n * 10) / 10
const mean = (xs: number[]) => xs.reduce((a, x) => a + x, 0) / xs.length

// Pendenza ai minimi quadrati, per giorno.
function slope(points: { x: number; y: number }[]) {
  const mx = mean(points.map((p) => p.x))
  const my = mean(points.map((p) => p.y))
  const num = points.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0)
  const den = points.reduce((a, p) => a + (p.x - mx) ** 2, 0)
  return den === 0 ? 0 : num / den
}

export async function getReport(db: Queryable, to: string, days: number): Promise<Report> {
  const from = addDays(to, -(days - 1))
  const [totals, goals, activity, weights] = await Promise.all([
    db.query<{ day: string; kcal: number; protein: number; carbs: number; fat: number }>(
      `select e.day, sum(i.calories) as kcal, sum(i.protein_g) as protein, sum(i.carbs_g) as carbs,
              sum(i.fat_g) as fat
         from meal_entry_items i join meal_entries e on e.id = i.meal_entry_id
        where e.day between $1 and $2 group by e.day`,
      [from, to],
    ),
    goalsBetween(db, from, to),
    db.query<{ day: string; kcal: number; counted: boolean }>(
      'select day, active_kcal as kcal, counted from day_activity where day between $1 and $2',
      [from, to],
    ),
    // Una pesata al giorno, quella di Salute se c'è (NUT-018).
    db.query<{ day: string; kg: number }>(
      `select distinct on (day) day, weight_kg as kg from body_weights
        where day between $1 and $2 order by day, (source = 'health') desc`,
      [from, to],
    ),
  ])
  const byDay = new Map(totals.rows.map((r) => [r.day, r]))
  const activityByDay = new Map(activity.rows.map((r) => [r.day, r]))

  const series: ReportDay[] = Array.from({ length: days }, (_, i) => {
    const date = addDays(from, i)
    const t = byDay.get(date)
    const goal = goals.get(date)
    return {
      date,
      kcal: Math.round(t?.kcal ?? 0),
      protein: round1(t?.protein ?? 0),
      carbs: round1(t?.carbs ?? 0),
      fat: round1(t?.fat ?? 0),
      logged: !!t,
      goalKcal: goal ? quotaFor(goal.kcal, activityByDay.get(date) ?? null).kcal : null,
    }
  })

  const logged = series.filter((d) => d.logged)
  const eligible = logged.filter((d) => d.goalKcal !== null)
  const inTarget = eligible.filter((d) => Math.abs(d.kcal - d.goalKcal!) <= ADHERENCE_KCAL).length
  const points = weights.rows.map((w) => ({ date: w.day, kg: w.kg }))
  const first = points[0]?.kg ?? null
  const last = points.at(-1)?.kg ?? null
  const goal = goals.get(to)

  return {
    days,
    from,
    to,
    series,
    averageKcal: logged.length ? Math.round(mean(logged.map((d) => d.kcal))) : null,
    trendKcalPerWeek:
      logged.length >= 4
        ? Math.round(slope(logged.map((d) => ({ x: series.indexOf(d), y: d.kcal }))) * 7)
        : null,
    adherence: {
      inTarget,
      total: eligible.length,
      pct: eligible.length ? Math.round((inTarget / eligible.length) * 100) : null,
    },
    macros: logged.length
      ? {
          protein: round1(mean(logged.map((d) => d.protein))),
          carbs: round1(mean(logged.map((d) => d.carbs))),
          fat: round1(mean(logged.map((d) => d.fat))),
        }
      : null,
    goal: goal ? { protein: goal.protein, carbs: goal.carbs, fat: goal.fat } : null,
    weight: {
      points,
      first,
      last,
      delta: points.length >= 2 && first !== null && last !== null ? round1(last - first) : null,
    },
  }
}

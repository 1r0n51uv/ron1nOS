import { num, shortDay } from '@/lib/format'

import type { Day } from './data'
import { todayRome } from './dates'

// Obiettivo su una riga, come nelle Impostazioni del mockup.
export function goalLine(g: { kcal: number; protein: number; carbs: number; fat: number }) {
  return `${num(g.kcal)} kcal · P ${num(g.protein)} · C ${num(g.carbs)} · G ${num(g.fat)} g`
}

// Ora di un evento, sull'ora di Roma come i giorni del diario: "oggi 10:12",
// altrimenti "21 ott 10:12".
export function whenLine(iso: string, now = new Date()) {
  const d = new Date(iso)
  const hm = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' })
  return todayRome(d) === todayRome(now) ? `oggi ${hm}` : `${shortDay(todayRome(d))} ${hm}`
}

// Cosa c'è nel prossimo pasto: la ricetta o gli alimenti pianificati.
export function plannedLine(day: Day) {
  const slot = day.slots.find((s) => s.slot === day.nextSlot)
  const planned = slot?.state === 'planned' ? slot.planned : null
  if (!planned) return 'Niente pianificato'
  const what = planned.recipeName ?? planned.items.map((i) => i.name).join(', ')
  return `${what} · ${num(planned.kcal)} kcal`
}

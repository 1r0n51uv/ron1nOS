import { num, shortDay } from '@/lib/format'
import type { FormatTools } from '@/preferences/formats'
import { makeFormats } from '@/preferences/formats'
import { DEFAULT_PREFERENCES } from '../../../server/preferences/schema.ts'

import type { Day } from './data'
import { todayRome } from './dates'

const KCAL = makeFormats(DEFAULT_PREFERENCES.formats)

// Energia nell'unità scelta (SET-010): "1840 kcal" o "7699 kJ".
export function energyText(kcal: number, fmt: FormatTools = KCAL) {
  return `${num(fmt.energy(kcal))} ${fmt.energyUnit}`
}

// Etichette dell'anello delle calorie, mangiate sulla quota del giorno.
export function ringLabels(eaten: number, target: number, fmt: FormatTools = KCAL) {
  const e = num(fmt.energy(eaten))
  const t = num(fmt.energy(target))
  const unit = fmt.energyUnit
  return {
    label: e,
    sublabel: target ? `di ${t} ${unit}` : unit,
    ariaLabel: target ? `${e} ${unit} su ${t}` : `${e} ${unit}`,
  }
}

// Obiettivo su una riga, come nelle Impostazioni del mockup.
export function goalLine(
  g: { kcal: number; protein: number; carbs: number; fat: number },
  fmt: FormatTools = KCAL,
) {
  return `${energyText(g.kcal, fmt)} · P ${num(g.protein)} · C ${num(g.carbs)} · G ${num(g.fat)} g`
}

// Ora di un evento, nel fuso scelto (SET-010): "oggi 10:12", altrimenti
// "21 ott 10:12". Il giorno resta quello del diario, sull'ora di Roma.
export function whenLine(iso: string, now = new Date(), timeZone = KCAL.timeZone) {
  const d = new Date(iso)
  const hm = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone })
  return todayRome(d) === todayRome(now) ? `oggi ${hm}` : `${shortDay(todayRome(d))} ${hm}`
}

// Cosa c'è nel prossimo pasto: la ricetta o gli alimenti pianificati.
export function plannedLine(day: Day, fmt: FormatTools = KCAL) {
  const slot = day.slots.find((s) => s.slot === day.nextSlot)
  const planned = slot?.state === 'planned' ? slot.planned : null
  if (!planned) return 'Niente pianificato'
  const what = planned.recipeName ?? planned.items.map((i) => i.name).join(', ')
  return `${what} · ${energyText(planned.kcal, fmt)}`
}

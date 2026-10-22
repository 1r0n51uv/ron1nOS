import { num } from '@/lib/format'

// Obiettivo su una riga, come nelle Impostazioni del mockup.
export function goalLine(g: { kcal: number; protein: number; carbs: number; fat: number }) {
  return `${num(g.kcal)} kcal · P ${num(g.protein)} · C ${num(g.carbs)} · G ${num(g.fat)} g`
}

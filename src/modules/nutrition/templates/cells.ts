import type { Template, TemplateCell, TemplateCellInput, TemplateInput } from '../data'

export const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']
export const WEEKDAY_NAMES = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica']

export function cellInput(c: TemplateCell): TemplateCellInput {
  return c.recipeId
    ? { weekday: c.weekday, slot: c.slot, recipeId: c.recipeId }
    : { weekday: c.weekday, slot: c.slot, foodId: c.foodId!, grams: c.grams! }
}

// La griglia con una cella cambiata (o svuotata, con `next` null).
export function withCell(
  t: Template,
  at: Pick<TemplateCell, 'weekday' | 'slot'>,
  next: TemplateCellInput | null,
): TemplateInput {
  const others = t.cells
    .filter((c) => (c.recipeId || c.foodId) && !(c.weekday === at.weekday && c.slot === at.slot))
    .map(cellInput)
  return { name: t.name, cells: next ? [...others, next] : others }
}

export function renamed(t: Template, name: string): TemplateInput {
  return { name, cells: t.cells.filter((c) => c.recipeId || c.foodId).map(cellInput) }
}

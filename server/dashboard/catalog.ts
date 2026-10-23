// Catalogo dei widget della dashboard (DASH-001): id, modulo, dimensioni e
// varianti. È la fonte unica: il backend lo usa per validare i layout
// (DASH-007), la dashboard web lo importa per sapere cosa può disporre.
// Le dimensioni sono in unità della griglia: 24 colonne, righe da 24px.

export const MODULES = [
  'nutrition',
  'workout',
  'weight',
  'home',
  'server',
  'containers',
  'downloads',
  'notes',
] as const

export type ModuleId = (typeof MODULES)[number]

export type WidgetVariant = 'compact' | 'detailed'

export type WidgetSize = { w: number; h: number }

export type CatalogEntry = {
  id: string
  module: ModuleId
  size: { min: WidgetSize; max: WidgetSize; default: WidgetSize }
  variants: readonly WidgetVariant[]
}

const size = (min: [number, number], def: [number, number], max: [number, number]) => ({
  min: { w: min[0], h: min[1] },
  default: { w: def[0], h: def[1] },
  max: { w: max[0], h: max[1] },
})

// L'ordine è quello della dashboard predefinita di oggi.
export const WIDGET_CATALOG: readonly CatalogEntry[] = [
  { id: 'nutrition.summary', module: 'nutrition', size: size([6, 7], [8, 9], [16, 14]), variants: [] },
  { id: 'workout.summary', module: 'workout', size: size([6, 6], [8, 8], [16, 12]), variants: [] },
  { id: 'weight.summary', module: 'weight', size: size([6, 5], [8, 6], [16, 10]), variants: [] },
  { id: 'home.summary', module: 'home', size: size([6, 6], [8, 8], [16, 14]), variants: [] },
  { id: 'server.summary', module: 'server', size: size([6, 6], [8, 8], [16, 12]), variants: [] },
  { id: 'containers.summary', module: 'containers', size: size([6, 6], [8, 8], [16, 16]), variants: [] },
  { id: 'downloads.summary', module: 'downloads', size: size([6, 6], [8, 8], [16, 16]), variants: [] },
  { id: 'notes.summary', module: 'notes', size: size([6, 5], [8, 6], [16, 12]), variants: [] },
]

export function catalogEntry(id: string) {
  return WIDGET_CATALOG.find((w) => w.id === id)
}

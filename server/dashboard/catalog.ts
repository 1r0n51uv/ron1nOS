// Catalogo dei widget della dashboard (DASH-001): id, modulo, dimensioni e
// varianti. È la fonte unica: il backend lo usa per validare i layout
// (DASH-007), la dashboard web lo importa per sapere cosa può disporre.
// Le dimensioni sono in unità della griglia: 24 colonne, righe da 24px.

export const GRID_COLUMNS = 24

export const MODULES = [
  'nutrition',
  'workout',
  'weight',
  'home',
  'server',
  'containers',
  'downloads',
  'notes',
  'documents',
] as const

export type ModuleId = (typeof MODULES)[number]

export type WidgetVariant = 'compact' | 'detailed'

export type WidgetSize = { w: number; h: number }

// Dati mostrati, dichiarati dal widget (DASH-005): una scelta tra valori,
// più valori insieme o un numero di elementi.
type Choice = { value: string; label: string }
export type WidgetOption =
  | { key: string; label: string; type: 'choice'; choices: readonly Choice[]; default: string }
  | { key: string; label: string; type: 'multi'; choices: readonly Choice[]; default: readonly string[] }
  | { key: string; label: string; type: 'count'; min: number; max: number; default: number }

export type OptionValue = string | readonly string[] | number

export type CatalogEntry = {
  id: string
  module: ModuleId
  size: { min: WidgetSize; max: WidgetSize; default: WidgetSize }
  // La prima è la predefinita; vuoto se il widget ha un solo aspetto.
  variants: readonly WidgetVariant[]
  options?: readonly WidgetOption[]
}

const size = (min: [number, number], def: [number, number], max: [number, number]) => ({
  min: { w: min[0], h: min[1] },
  default: { w: def[0], h: def[1] },
  max: { w: max[0], h: max[1] },
})

// Prima i `summary` nell'ordine della dashboard predefinita, poi i widget
// più piccoli (DASH-002), che si aggiungono dal catalogo.
export const WIDGET_CATALOG: readonly CatalogEntry[] = [
  {
    id: 'nutrition.summary',
    module: 'nutrition',
    size: size([6, 7], [8, 10], [16, 14]),
    variants: [],
    options: [
      {
        key: 'macros',
        label: 'Macro',
        type: 'multi',
        choices: [
          { value: 'protein', label: 'Proteine' },
          { value: 'carbs', label: 'Carboidrati' },
          { value: 'fat', label: 'Grassi' },
        ],
        default: ['protein', 'carbs', 'fat'],
      },
    ],
  },
  { id: 'workout.summary', module: 'workout', size: size([6, 6], [8, 8], [16, 12]), variants: [] },
  {
    id: 'weight.summary',
    module: 'weight',
    size: size([6, 4], [8, 7], [16, 10]),
    variants: ['detailed', 'compact'],
  },
  { id: 'home.summary', module: 'home', size: size([6, 6], [8, 8], [16, 14]), variants: [] },
  { id: 'server.summary', module: 'server', size: size([6, 6], [8, 11], [16, 14]), variants: [] },
  { id: 'containers.summary', module: 'containers', size: size([6, 6], [8, 8], [16, 16]), variants: [] },
  {
    id: 'downloads.summary',
    module: 'downloads',
    size: size([6, 6], [8, 8], [16, 16]),
    variants: [],
    options: [{ key: 'limit', label: 'Download mostrati', type: 'count', min: 1, max: 6, default: 3 }],
  },
  { id: 'notes.summary', module: 'notes', size: size([6, 5], [8, 7], [16, 12]), variants: [] },
  { id: 'documents.summary', module: 'documents', size: size([6, 6], [8, 8], [16, 14]), variants: [] },
  { id: 'nutrition.calories', module: 'nutrition', size: size([4, 6], [6, 7], [8, 9]), variants: [] },
  { id: 'nutrition.next-meal', module: 'nutrition', size: size([6, 4], [8, 4], [12, 6]), variants: [] },
  { id: 'nutrition.supplements', module: 'nutrition', size: size([6, 4], [8, 4], [12, 6]), variants: [] },
  {
    id: 'server.metric',
    module: 'server',
    size: size([4, 4], [6, 4], [12, 8]),
    variants: ['detailed', 'compact'],
    options: [
      {
        key: 'metric',
        label: 'Risorsa',
        type: 'choice',
        choices: [
          { value: 'cpu', label: 'CPU' },
          { value: 'ram', label: 'RAM' },
          { value: 'disk', label: 'Disco' },
          { value: 'net', label: 'Rete' },
        ],
        default: 'cpu',
      },
    ],
  },
  { id: 'downloads.speed', module: 'downloads', size: size([4, 4], [6, 4], [10, 6]), variants: [] },
  { id: 'containers.status', module: 'containers', size: size([4, 4], [6, 4], [10, 6]), variants: [] },
]

// Il layout predefinito (DASH-008) ha solo i `summary`, come la dashboard di oggi.
export function isStarter(entry: CatalogEntry) {
  return entry.id.endsWith('.summary')
}

export function catalogEntry(id: string) {
  return WIDGET_CATALOG.find((w) => w.id === id)
}

// Le opzioni del widget con i predefiniti al posto di quelle non salvate.
export function resolveOptions(entry: CatalogEntry, saved: Record<string, unknown> = {}) {
  const out: Record<string, OptionValue> = {}
  for (const option of entry.options ?? []) {
    const value = saved[option.key]
    out[option.key] =
      value !== undefined && !optionError(option, value) ? (value as OptionValue) : option.default
  }
  return out
}

// Il primo problema delle opzioni salvate per il widget, o null.
export function optionsError(entry: CatalogEntry, saved: Record<string, unknown>) {
  const declared = entry.options ?? []
  for (const [key, value] of Object.entries(saved)) {
    const option = declared.find((o) => o.key === key)
    if (!option) return `opzione sconosciuta ${key}`
    const problem = optionError(option, value)
    if (problem) return `${key}: ${problem}`
  }
  return null
}

function optionError(option: WidgetOption, value: unknown) {
  const values = option.type === 'count' ? [] : option.choices.map((c) => c.value)
  switch (option.type) {
    case 'choice':
      return typeof value === 'string' && values.includes(value) ? null : 'valore non previsto'
    case 'multi':
      return Array.isArray(value) &&
        value.every((v) => typeof v === 'string' && values.includes(v)) &&
        new Set(value).size === value.length
        ? null
        : 'valori non previsti o ripetuti'
    case 'count':
      return Number.isInteger(value) && (value as number) >= option.min && (value as number) <= option.max
        ? null
        : `atteso un intero tra ${option.min} e ${option.max}`
  }
}

import { widgets as containers } from '@/modules/containers/widgets'
import { widgets as downloads } from '@/modules/downloads/widgets'
import { widgets as home } from '@/modules/home/widgets'
import { widgets as notes } from '@/modules/notes/widgets'
import { widgets as nutrition } from '@/modules/nutrition/widgets'
import { widgets as server } from '@/modules/server/widgets'
import { widgets as weight } from '@/modules/weight/widgets'
import { widgets as workout } from '@/modules/workout/widgets'
import { WIDGET_CATALOG } from '../../server/dashboard/catalog.ts'
import type { ModuleId, WidgetDef, WidgetModuleDef } from './types'

// I widget dichiarati dai moduli, uniti alla loro voce del catalogo.
export const moduleWidgets: WidgetModuleDef[] = [
  ...nutrition,
  ...workout,
  ...weight,
  ...home,
  ...server,
  ...containers,
  ...downloads,
  ...notes,
]

const byId = new Map(moduleWidgets.map((w) => [w.id, w]))

// Nell'ordine del catalogo; una voce senza componente non si mostra.
export const registry: WidgetDef[] = WIDGET_CATALOG.flatMap((entry) => {
  const def = byId.get(entry.id)
  return def ? [{ ...entry, title: def.title, description: def.description, component: def.component }] : []
})

// I widget disponibili: quelli dei moduli spenti (SET-005) restano fuori.
export function availableWidgets(disabled: readonly ModuleId[] = []) {
  return registry.filter((w) => !disabled.includes(w.module))
}

export function findWidget(id: string) {
  return registry.find((w) => w.id === id)
}

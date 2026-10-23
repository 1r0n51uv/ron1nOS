import type { ComponentType } from 'react'

import type { CatalogEntry, OptionValue, WidgetVariant } from '../../server/dashboard/catalog.ts'

export type {
  ModuleId,
  OptionValue,
  WidgetOption,
  WidgetSize,
  WidgetVariant,
} from '../../server/dashboard/catalog.ts'

// Variante e opzioni arrivano già risolte, con i predefiniti (DASH-005).
export type WidgetProps = {
  className?: string
  variant?: WidgetVariant
  options?: Readonly<Record<string, OptionValue>>
}

// Quello che un modulo dichiara nel suo widgets.ts: il resto (modulo,
// dimensioni, varianti) arriva dal catalogo condiviso con il backend.
export type WidgetModuleDef = {
  id: string
  title: string
  description: string
  component: ComponentType<WidgetProps>
}

export type WidgetDef = CatalogEntry & Omit<WidgetModuleDef, 'id'>

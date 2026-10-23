import type { ComponentType } from 'react'

import type { CatalogEntry } from '../../server/dashboard/catalog.ts'

export type { ModuleId, WidgetSize, WidgetVariant } from '../../server/dashboard/catalog.ts'

export type WidgetProps = { className?: string }

// Quello che un modulo dichiara nel suo widgets.ts: il resto (modulo,
// dimensioni, varianti) arriva dal catalogo condiviso con il backend.
export type WidgetModuleDef = {
  id: string
  title: string
  description: string
  component: ComponentType<WidgetProps>
}

export type WidgetDef = CatalogEntry & Omit<WidgetModuleDef, 'id'>

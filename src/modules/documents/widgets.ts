import type { WidgetModuleDef } from '@/widgets/types'
import { DocumentsWidget } from './Widget'

export const widgets: WidgetModuleDef[] = [
  {
    id: 'documents.summary',
    title: 'Documenti',
    description: 'Documenti in evidenza e in scadenza.',
    component: DocumentsWidget,
  },
]

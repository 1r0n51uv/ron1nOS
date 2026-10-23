import type { WidgetModuleDef } from '@/widgets/types'
import { NotesWidget } from './Widget'

export const widgets: WidgetModuleDef[] = [
  {
    id: 'notes.summary',
    title: 'Nota fissata',
    description: 'La nota fissata in cima.',
    component: NotesWidget,
  },
]

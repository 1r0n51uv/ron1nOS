import type { WidgetModuleDef } from '@/widgets/types'
import { ServerWidget } from './Widget'

export const widgets: WidgetModuleDef[] = [
  {
    id: 'server.summary',
    title: 'Server',
    description: 'CPU, memoria, disco e rete del server.',
    component: ServerWidget,
  },
]

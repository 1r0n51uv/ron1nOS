import type { WidgetModuleDef } from '@/widgets/types'
import { ServerMetricWidget } from './MetricWidget'
import { ServerWidget } from './Widget'

export const widgets: WidgetModuleDef[] = [
  {
    id: 'server.summary',
    title: 'Server',
    description: 'CPU, memoria, disco e rete del server.',
    component: ServerWidget,
  },
  {
    id: 'server.metric',
    title: 'Risorsa del server',
    description: 'Una sola risorsa a scelta: CPU, RAM, disco o rete.',
    component: ServerMetricWidget,
  },
]

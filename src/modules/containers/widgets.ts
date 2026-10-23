import type { WidgetModuleDef } from '@/widgets/types'
import { ContainerStatusWidget } from './StatusWidget'
import { ContainersWidget } from './Widget'

export const widgets: WidgetModuleDef[] = [
  {
    id: 'containers.summary',
    title: 'Container',
    description: 'I container Docker e il loro stato.',
    component: ContainersWidget,
  },
  {
    id: 'containers.status',
    title: 'Stato container',
    description: 'Solo il conteggio di attivi e fermi.',
    component: ContainerStatusWidget,
  },
]

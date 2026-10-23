import type { WidgetModuleDef } from '@/widgets/types'
import { ContainersWidget } from './Widget'

export const widgets: WidgetModuleDef[] = [
  {
    id: 'containers.summary',
    title: 'Container',
    description: 'I container Docker e il loro stato.',
    component: ContainersWidget,
  },
]

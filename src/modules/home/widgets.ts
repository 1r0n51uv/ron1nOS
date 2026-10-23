import type { WidgetModuleDef } from '@/widgets/types'
import { HomeWidget } from './Widget'

export const widgets: WidgetModuleDef[] = [
  {
    id: 'home.summary',
    title: 'Casa',
    description: 'Luci e dispositivi di casa.',
    component: HomeWidget,
  },
]

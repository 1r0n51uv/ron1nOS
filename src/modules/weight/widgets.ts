import type { WidgetModuleDef } from '@/widgets/types'
import { WeightWidget } from './Widget'

export const widgets: WidgetModuleDef[] = [
  {
    id: 'weight.summary',
    title: 'Peso',
    description: "Il peso di oggi e l'andamento recente.",
    component: WeightWidget,
  },
]

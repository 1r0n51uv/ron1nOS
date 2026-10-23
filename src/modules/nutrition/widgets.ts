import type { WidgetModuleDef } from '@/widgets/types'
import { NutritionWidget } from './Widget'

export const widgets: WidgetModuleDef[] = [
  {
    id: 'nutrition.summary',
    title: 'Nutrizione',
    description: 'Calorie, macro e prossimo pasto di oggi.',
    component: NutritionWidget,
  },
]

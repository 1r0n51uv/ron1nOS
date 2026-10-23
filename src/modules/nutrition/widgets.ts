import type { WidgetModuleDef } from '@/widgets/types'
import { CaloriesWidget, NextMealWidget, SupplementsWidget } from './SmallWidgets'
import { NutritionWidget } from './Widget'

export const widgets: WidgetModuleDef[] = [
  {
    id: 'nutrition.summary',
    title: 'Nutrizione',
    description: 'Calorie, macro e prossimo pasto di oggi.',
    component: NutritionWidget,
  },
  {
    id: 'nutrition.calories',
    title: 'Calorie',
    description: 'Solo l’anello delle calorie, per uno spazio piccolo.',
    component: CaloriesWidget,
  },
  {
    id: 'nutrition.next-meal',
    title: 'Prossimo pasto',
    description: 'Cosa c’è nel prossimo pasto pianificato.',
    component: NextMealWidget,
  },
  {
    id: 'nutrition.supplements',
    title: 'Integratori',
    description: 'Quelli presi oggi e quelli che mancano.',
    component: SupplementsWidget,
  },
]

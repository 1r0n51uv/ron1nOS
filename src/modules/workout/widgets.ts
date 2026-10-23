import type { WidgetModuleDef } from '@/widgets/types'
import { WorkoutWidget } from './Widget'

export const widgets: WidgetModuleDef[] = [
  {
    id: 'workout.summary',
    title: 'Allenamento',
    description: "L'allenamento in corso o l'ultimo fatto.",
    component: WorkoutWidget,
  },
]

import type { WidgetModuleDef } from '@/widgets/types'
import { WorkoutWidget } from './Widget'

export const widgets: WidgetModuleDef[] = [
  {
    id: 'workout.summary',
    title: 'Allenamento',
    description: "L'ultimo allenamento, la settimana e i giorni di fila.",
    component: WorkoutWidget,
  },
]

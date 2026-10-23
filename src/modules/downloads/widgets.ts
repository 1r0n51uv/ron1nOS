import type { WidgetModuleDef } from '@/widgets/types'
import { DownloadsWidget } from './Widget'

export const widgets: WidgetModuleDef[] = [
  {
    id: 'downloads.summary',
    title: 'Download',
    description: 'I torrent attivi e la velocità.',
    component: DownloadsWidget,
  },
]

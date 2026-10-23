import type { WidgetModuleDef } from '@/widgets/types'
import { DownloadSpeedWidget } from './SpeedWidget'
import { DownloadsWidget } from './Widget'

export const widgets: WidgetModuleDef[] = [
  {
    id: 'downloads.summary',
    title: 'Download',
    description: 'I torrent attivi e la velocità.',
    component: DownloadsWidget,
  },
  {
    id: 'downloads.speed',
    title: 'Velocità download',
    description: 'Velocità e numero di torrent attivi.',
    component: DownloadSpeedWidget,
  },
]

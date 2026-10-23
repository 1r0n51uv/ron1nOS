import { Metric, StatusPill, WidgetCard } from '@/components/ron1n'
import { WidgetSkeleton } from '@/components/WidgetSkeleton'
import { num } from '@/lib/format'
import type { WidgetProps } from '@/widgets/types'
import { useDownloads } from './data'

// Velocità e torrent attivi (DASH-002), dallo stesso hook del widget Download.
export function DownloadSpeedWidget({ className }: WidgetProps) {
  const { data, error } = useDownloads()
  if (error) {
    return (
      <WidgetCard title="Download" meta="offline" className={className}>
        <div className="flex">
          <StatusPill tone="alert" size="small">
            qBittorrent · offline
          </StatusPill>
        </div>
      </WidgetCard>
    )
  }
  if (!data) return <WidgetSkeleton title="Download" className={className} />

  const active = data.torrents.filter((t) => t.state === 'downloading').length
  return (
    <WidgetCard title="Download" className={className}>
      <Metric value={num(data.downloadSpeed / 1_000_000, 1)} unit="MB/s" size="md" />
      <span className="text-[13px] text-ink-muted">
        <span className="font-mono">{active}</span> {active === 1 ? 'attivo' : 'attivi'}
      </span>
    </WidgetCard>
  )
}

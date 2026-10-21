import { WidgetCard } from '@/components/ron1n'
import { WidgetSkeleton } from '@/components/WidgetSkeleton'
import { Progress } from '@/components/ui/progress'
import { num } from '@/lib/format'
import type { Torrent } from './data'
import { useDownloads } from './data'
import { eta, summary, VISIBLE } from './format'

function TorrentRow({ torrent }: { torrent: Torrent }) {
  const pct = Math.floor(torrent.progress * 100)
  return (
    <li className="flex flex-col gap-2">
      <div className="flex justify-between gap-3 text-sm">
        <span className="min-w-0 truncate" title={torrent.name}>
          {torrent.name}
        </span>
        <span className="font-mono">{pct}%</span>
      </div>
      <Progress value={pct} aria-label={`${torrent.name} ${pct}%`} />
      <div className="font-mono text-xs text-ink-muted">{eta(torrent.etaSeconds)}</div>
    </li>
  )
}

export function DownloadsWidget({ className }: { className?: string }) {
  const { data } = useDownloads()
  if (!data) return <WidgetSkeleton title="Download" className={className} />

  const active = data.torrents.filter((t) => t.state === 'downloading').slice(0, VISIBLE)
  const rest = summary(data)

  return (
    <WidgetCard
      title="Download"
      meta={`↓ ${num(data.downloadSpeed / 1_000_000, 1)} MB/s`}
      className={className}
    >
      {active.length ? (
        <ul className="m-0 flex list-none flex-col gap-4 p-0" aria-label="Download in corso">
          {active.map((t) => (
            <TorrentRow key={t.hash} torrent={t} />
          ))}
        </ul>
      ) : (
        <div className="text-sm text-ink-muted">Nessun download attivo.</div>
      )}
      {rest ? <div className="text-[13px] text-ink-muted">{rest}</div> : null}
    </WidgetCard>
  )
}

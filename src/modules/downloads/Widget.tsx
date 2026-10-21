import { Icon, StatusPill, WidgetCard } from '@/components/ron1n'
import { WidgetSkeleton } from '@/components/WidgetSkeleton'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { num } from '@/lib/format'
import type { Torrent } from './data'
import { useDownloads } from './data'
import { eta, problem, summary, VISIBLE } from './format'
import { AddTorrentDialog } from './wizard/AddTorrentDialog'

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

// Riga in fondo al widget: riassunto a sinistra, Aggiungi a destra.
function Footer({ text, disabled }: { text: string; disabled?: boolean }) {
  return (
    <div className="mt-auto flex items-center justify-between gap-3">
      <div className="text-[13px] text-ink-muted">{text}</div>
      <AddTorrentDialog>
        <Button variant="glass" size="sm" disabled={disabled}>
          <Icon name="plus" size={16} />
          Aggiungi
        </Button>
      </AddTorrentDialog>
    </div>
  )
}

export function DownloadsWidget({ className }: { className?: string }) {
  const { data, error } = useDownloads()
  // Un errore vince sui dati vecchi: meglio dire che non sappiamo.
  if (error) {
    return (
      <WidgetCard title="Download" meta="offline" className={className}>
        <div className="flex flex-col items-start gap-2.5" role="status">
          <StatusPill tone="alert">qBittorrent · offline</StatusPill>
          <div className="text-sm text-ink-muted">{problem(error)}. Riprovo ogni 5 secondi.</div>
        </div>
        <Footer text="" disabled />
      </WidgetCard>
    )
  }
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
      <Footer text={rest} />
    </WidgetCard>
  )
}

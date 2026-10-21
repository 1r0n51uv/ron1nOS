import type { ReactNode } from 'react'

import { AlertRow } from '@/components/ron1n'
import { ApiError } from '@/lib/api'
import { fileSize } from '@/lib/format'
import type { Draft, Space } from '../data'
import { selectedSize } from './tree'

// Numero grande con l'unità più piccola, come nelle tile del mockup.
function Amount({ bytes }: { bytes: number }) {
  const [value, unit] = fileSize(bytes).split(' ')
  return (
    <span className="font-mono text-[26px] leading-[30px] font-semibold">
      {value} <span className="text-sm text-ink-muted">{unit}</span>
    </span>
  )
}

function Tile({ label, children, note }: { label: string; children: ReactNode; note: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-[20px] border border-glass-border bg-glass p-4">
      <span className="text-[13px] font-medium text-ink-muted">{label}</span>
      {children}
      <span className="text-xs text-ink-muted">{note}</span>
    </div>
  )
}

// Passo 4 (DL-007): riepilogo prima di Avvia.
export function SummaryStep({
  draft,
  selected,
  space,
  spaceError,
  startError,
  onRetry,
}: {
  draft: Draft
  selected: ReadonlySet<number>
  space?: Space
  spaceError: Error | null
  startError: Error | null
  onRetry: () => void
}) {
  const needed = selectedSize(draft.files, selected)
  const short = space && needed > space.free
  return (
    <>
      <div className="flex flex-col gap-1">
        <span className="text-[13px] font-medium text-ink-muted">Torrent</span>
        <span className="truncate text-lg leading-6 font-semibold" title={draft.name}>
          {draft.name}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Tile label="Da scaricare" note={`${selected.size} file su ${draft.files.length}`}>
          <Amount bytes={needed} />
        </Tile>
        <Tile
          label="Spazio libero"
          note={space ? `dopo il download: ${fileSize(Math.max(0, space.free - needed))}` : 'lettura…'}
        >
          {space ? (
            <Amount bytes={space.free} />
          ) : (
            <span className="font-mono text-[26px] leading-[30px]">—</span>
          )}
        </Tile>
      </div>
      <div className="flex items-center justify-between gap-3 rounded-[20px] border border-glass-border bg-glass px-4 py-3.5">
        <span className="text-[13px] font-medium text-ink-muted">Cartella</span>
        <span className="font-mono text-[13px]">{space?.path ?? '/downloads'}</span>
      </div>
      {short ? (
        <AlertRow
          title="Spazio insufficiente."
          body={`Servono ${fileSize(needed)}, liberi ${fileSize(space.free)}. Togli qualche file al passo precedente.`}
        />
      ) : null}
      {spaceError ? (
        <AlertRow title="Spazio libero non disponibile." body="qBittorrent non risponde. Riprova tra poco." />
      ) : null}
      {startError ? (
        startError instanceof ApiError && startError.code === 'insufficient_space' ? (
          <AlertRow title="Spazio insufficiente." body="Togli qualche file al passo precedente." />
        ) : (
          <AlertRow
            title="Avvio non riuscito. Riprova."
            body="qBittorrent non ha accettato il torrent."
            actionLabel="Riprova"
            onAction={onRetry}
          />
        )
      ) : null}
    </>
  )
}

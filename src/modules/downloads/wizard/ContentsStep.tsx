import type { ReactNode } from 'react'

import { AlertRow } from '@/components/ron1n'
import { ApiError } from '@/lib/api'
import { fileSize } from '@/lib/format'
import type { Draft, DuplicateTorrent } from '../data'
import { STATE_LABEL, waitClock } from './source'

function failure(error: Error) {
  const code = error instanceof ApiError ? error.code : ''
  if (code === 'invalid_torrent') {
    return { title: 'File torrent non valido.', body: 'Il file non è un torrent o supera 10 MB.' }
  }
  if (code === 'torrent_fetch_failed') {
    return {
      title: 'Impossibile scaricare il file torrent.',
      body: 'L’indirizzo non risponde, non è permesso o il file non è un torrent.',
    }
  }
  if (code === 'invalid_link') {
    return { title: 'Link non valido.', body: 'Serve un link magnet o l’URL http(s) di un file .torrent.' }
  }
  if (code === 'duplicate' && error instanceof ApiError) {
    const t = error.body.torrent as DuplicateTorrent | undefined
    return {
      title: 'Questo torrent è già nei download.',
      body: t ? `${t.name} · ${STATE_LABEL[t.state]}` : undefined,
    }
  }
  if (code === 'qbittorrent_unreachable' || code === 'network') {
    return { title: 'qBittorrent non raggiungibile.', body: 'Riprova tra poco.' }
  }
  if (code === 'draft_not_found') {
    return { title: 'Il torrent non c’è più.', body: 'È stato tolto da qBittorrent. Ricomincia dal passo 1.' }
  }
  return { title: 'Lettura non riuscita.', body: error.message }
}

function Spinner() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true" className="animate-spin">
      <circle cx="28" cy="28" r="24" fill="none" stroke="var(--track)" strokeWidth="4" />
      <circle
        cx="28"
        cy="28"
        r="24"
        fill="none"
        stroke="var(--brand)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray="45 151"
        transform="rotate(-90 28 28)"
      />
    </svg>
  )
}

function Waiting({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-[260px] flex-col items-center justify-center gap-[18px] rounded-[20px] border border-glass-border bg-glass text-center">
      {children}
    </div>
  )
}

// Passo 2 (DL-005): lettura dei contenuti. Con un file o un URL è subito
// pronto; con un magnet si aspettano i metadati dai peer.
export function ContentsStep({
  draft,
  error,
  onBack,
  onRetry,
}: {
  draft?: Draft
  error: Error | null
  onBack: () => void
  onRetry: () => void
}) {
  if (error) {
    const { title, body } = failure(error)
    return <AlertRow title={title} body={body} actionLabel="Indietro" onAction={onBack} />
  }
  if (!draft) {
    return (
      <Waiting>
        <Spinner />
        <span className="text-base font-medium">Lettura del torrent…</span>
      </Waiting>
    )
  }
  const footer =
    draft.source === 'magnet' ? (
      <div className="truncate font-mono text-xs text-ink-muted">magnet · {draft.infoHash}</div>
    ) : null

  if (draft.status === 'timeout') {
    return (
      <>
        <AlertRow
          title="Nessun peer ha fornito i metadati."
          body={`Attesi ${draft.metadata?.limitSeconds ?? 60} secondi. Puoi riprovare per altri ${draft.metadata?.limitSeconds ?? 60}.`}
          actionLabel="Riprova"
          onAction={onRetry}
        />
        {footer}
      </>
    )
  }
  if (draft.status === 'metadata') {
    const m = draft.metadata
    return (
      <>
        <Waiting>
          <Spinner />
          <div className="flex flex-col gap-1.5" role="status">
            <span className="text-base font-medium">Recupero dei metadati…</span>
            <span className="text-[13px] text-ink-muted">
              I peer stanno inviando nome ed elenco dei file.
            </span>
          </div>
          {m ? (
            <div className="flex gap-4 font-mono text-xs text-ink-muted">
              <span>{m.peers} peer</span>
              <span>·</span>
              <span>
                {waitClock(m.waitedSeconds)} su {waitClock(m.limitSeconds)}
              </span>
            </div>
          ) : null}
        </Waiting>
        {footer}
      </>
    )
  }
  return (
    <>
      <div className="flex flex-col gap-1 rounded-[20px] border border-glass-border bg-glass p-4">
        <span className="text-[13px] font-medium text-ink-muted">Torrent</span>
        <span className="truncate text-lg leading-6 font-semibold" title={draft.name}>
          {draft.name}
        </span>
        <span className="font-mono text-[13px] text-ink-muted">
          {draft.files.length} file · {fileSize(draft.size)}
        </span>
      </div>
      {footer}
    </>
  )
}

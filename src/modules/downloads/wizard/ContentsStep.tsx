import { AlertRow } from '@/components/ron1n'
import { ApiError } from '@/lib/api'
import { fileSize } from '@/lib/format'
import type { Draft } from '../data'

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
  return { title: 'Lettura non riuscita.', body: error.message }
}

// Passo 2 (DL-005): lettura dei contenuti. Con un file o un URL è subito
// pronto; i magnet arrivano con #9.
export function ContentsStep({
  draft,
  error,
  onBack,
}: {
  draft?: Draft
  error: Error | null
  onBack: () => void
}) {
  if (error) {
    const { title, body } = failure(error)
    return <AlertRow title={title} body={body} actionLabel="Indietro" onAction={onBack} />
  }
  if (!draft) {
    return (
      <div className="flex h-[200px] items-center justify-center rounded-[20px] border border-glass-border bg-glass text-sm text-ink-muted">
        Lettura del torrent…
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-1 rounded-[20px] border border-glass-border bg-glass p-4">
      <span className="text-[13px] font-medium text-ink-muted">Torrent</span>
      <span className="truncate text-lg leading-6 font-semibold" title={draft.name}>
        {draft.name}
      </span>
      <span className="font-mono text-[13px] text-ink-muted">
        {draft.files.length} file · {fileSize(draft.size)}
      </span>
    </div>
  )
}

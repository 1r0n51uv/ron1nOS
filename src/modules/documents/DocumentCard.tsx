import { Link } from 'react-router'

import { Icon, StatusPill } from '@/components/ron1n'
import { fileSize } from '@/lib/format'
import type { DocumentSummary } from './data'
import { fileUrl } from './data'
import { expiryText, fileKind } from './format'

// Una card della griglia (DOC-002, decisione 7): miniatura del primo
// allegato se è un'immagine, altrimenti il tipo del file; tipo, titolo,
// titolare e scadenza. Nessun valore dei campi.
export function DocumentCard({ doc }: { doc: DocumentSummary }) {
  const expiry = expiryText(doc.expiresOn, doc.expiry)
  return (
    <Link
      to={`/documenti/${doc.id}`}
      className="flex min-w-0 flex-col gap-3 rounded-[18px] border border-glass-border bg-glass p-3 text-ink no-underline hover:bg-glass-strong"
    >
      <div className="relative flex h-[132px] items-center justify-center overflow-hidden rounded-[14px] border border-glass-border bg-glass-strong">
        {doc.thumbFileId ? (
          <img
            src={fileUrl(doc.id, doc.thumbFileId, { thumb: true })}
            alt=""
            className="size-full object-cover"
          />
        ) : (
          <span className="font-mono text-[13px] tracking-[0.1em] text-ink-muted">
            {doc.firstFile
              ? `${fileKind(doc.firstFile.mime)} · ${fileSize(doc.firstFile.size)}`
              : 'NESSUN FILE'}
          </span>
        )}
        {doc.pinnedAt ? (
          <span className="absolute top-2 right-2 flex size-8 items-center justify-center rounded-full bg-black/35 text-brand-text">
            <Icon name="star" size={16} label="In evidenza" />
          </span>
        ) : null}
      </div>
      <div className="truncate text-[15px] font-medium">{doc.title}</div>
      <div className="flex items-center justify-between gap-2 text-xs text-ink-muted">
        <span className="min-w-0 truncate">
          {doc.holder} · {doc.typeName ?? 'File'}
        </span>
        {expiry === 'Scaduto' ? (
          <StatusPill tone="alert" size="small">
            Scaduto
          </StatusPill>
        ) : expiry ? (
          <span className={doc.expiry?.status === 'expiring' ? 'font-mono text-brand-text' : 'font-mono'}>
            {expiry}
          </span>
        ) : null}
      </div>
    </Link>
  )
}

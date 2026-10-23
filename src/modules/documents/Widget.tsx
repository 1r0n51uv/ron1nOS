import { Link } from 'react-router'

import { Icon, StatusPill, WidgetCard } from '@/components/ron1n'
import { WidgetSkeleton } from '@/components/WidgetSkeleton'
import { ApiError } from '@/lib/api'
import { useDocuments } from './data'
import { widgetExpiry, widgetView } from './format'

// Widget Documenti (DOC-001): fissati ed in scadenza. Solo tipo, titolo,
// titolare e scadenza: nessun valore dei campi.
export function DocumentsWidget({ className }: { className?: string }) {
  const { data, error } = useDocuments()

  if (!data && error) {
    const disabled = error instanceof ApiError && error.code === 'documents_disabled'
    return (
      <WidgetCard title="Documenti" className={className}>
        <div role="status" className="text-sm text-ink-muted">
          {disabled
            ? 'Modulo spento: servono il login e DOCUMENTS_KEY nel .env del server.'
            : 'Documenti non raggiungibili.'}
        </div>
      </WidgetCard>
    )
  }
  if (!data) return <WidgetSkeleton title="Documenti" className={className} />

  if (!data.length) {
    return (
      <WidgetCard title="Documenti" className={className}>
        <div className="flex flex-col items-start gap-3">
          <p className="m-0 text-sm text-ink-muted">
            Nessun documento. Carica un file per iniziare: un documento, un PDF con le sue info o un file da
            tenere.
          </p>
          <Link
            to="/documenti"
            className="inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] text-ink no-underline glass-chip"
          >
            <Icon name="plus" size={16} />
            Aggiungi documento
          </Link>
        </div>
      </WidgetCard>
    )
  }

  const { pinned, expiring, nextDays } = widgetView(data)
  return (
    <WidgetCard title="Documenti" action={{ label: 'Dettagli', to: '/documenti' }} className={className}>
      <div className="flex flex-col gap-4">
        {pinned.length ? (
          <ul aria-label="In evidenza" className="m-0 grid list-none grid-cols-2 gap-2 p-0">
            {pinned.map((d) => (
              <li key={d.id} className="min-w-0">
                <Link
                  to={`/documenti/${d.id}`}
                  className="flex min-h-11 items-center gap-2.5 rounded-[12px] px-3 text-sm text-ink no-underline glass-chip hover:bg-glass-hover"
                >
                  <Icon name="documents" size={18} className="text-ink-muted" />
                  <span className="min-w-0 truncate">{d.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
        {expiring.length ? (
          <ul aria-label="In scadenza" className="m-0 flex list-none flex-col p-0">
            {expiring.map((d) => (
              <li
                key={d.id}
                className="flex min-h-10 items-center justify-between gap-3 border-t border-glass-border text-sm first:border-t-0"
              >
                <Link
                  to={`/documenti/${d.id}`}
                  className="min-w-0 truncate text-ink no-underline hover:underline"
                >
                  {d.typeName ?? d.title}
                  {d.holder !== 'Io' ? ` · ${d.holder}` : ''}
                </Link>
                {d.expiry!.status === 'expired' ? (
                  <StatusPill tone="alert" size="small">
                    Scaduto
                  </StatusPill>
                ) : (
                  <span className="shrink-0 font-mono text-[13px] text-ink-muted">
                    {widgetExpiry(d.expiry!)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <StatusPill size="small">Tutto in regola</StatusPill>
            {nextDays !== null ? (
              <span className="text-[13px] text-ink-muted">
                Prossima scadenza tra <span className="font-mono">{nextDays}</span> giorni
              </span>
            ) : null}
          </div>
        )}
      </div>
    </WidgetCard>
  )
}

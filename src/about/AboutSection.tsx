import type { ReactNode } from 'react'

import { StatusPill, WidgetCard } from '@/components/ron1n'
import { DATABASE_LABELS, REPOSITORY_URL, SPEC_URL, uptime, useAbout, useHealth } from './data'

const builtOn = (iso: string) =>
  new Date(iso).toLocaleString('it-IT', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

// Impostazioni › Informazioni (SET-012): versione dell'immagine, stato di
// backend e database, da quanto è acceso, e i link al codice.
export function AboutSection() {
  const health = useHealth()
  const about = useAbout().data
  const commit = about?.version.commit
  const builtAt = about?.version.builtAt

  return (
    <>
      <WidgetCard title="Versione">
        <dl className="m-0 flex flex-col">
          <Row label="Commit">
            {commit ? (
              <a
                href={`${REPOSITORY_URL}/commit/${commit}`}
                target="_blank"
                rel="noreferrer"
                className="hit-area font-mono text-ink underline decoration-ink/40 underline-offset-4 hover:decoration-ink"
              >
                {commit.slice(0, 7)}
              </a>
            ) : (
              <span className="text-ink-muted">build locale</span>
            )}
          </Row>
          <Row label="Build">
            {builtAt ? (
              <span className="font-mono">{builtOn(builtAt)}</span>
            ) : (
              <span className="text-ink-muted">non indicata</span>
            )}
          </Row>
        </dl>
      </WidgetCard>

      <WidgetCard title="Stato">
        <dl className="m-0 flex flex-col">
          <Row label="Backend">
            {health.data ? (
              <StatusPill size="small">attivo</StatusPill>
            ) : health.isError ? (
              <StatusPill size="small" tone="alert">
                non raggiungibile
              </StatusPill>
            ) : (
              <span className="text-ink-muted">…</span>
            )}
          </Row>
          <Row label="Database">
            {health.data ? (
              <StatusPill size="small" tone={health.data.database === 'ok' ? 'ok' : 'alert'}>
                {DATABASE_LABELS[health.data.database]}
              </StatusPill>
            ) : (
              <span className="text-ink-muted">…</span>
            )}
          </Row>
          <Row label="Acceso da">
            {about ? <span className="font-mono">{uptime(about.uptimeSeconds)}</span> : '…'}
          </Row>
        </dl>
      </WidgetCard>

      <WidgetCard title="Link">
        <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm">
          <li>
            <a
              href={REPOSITORY_URL}
              target="_blank"
              rel="noreferrer"
              className="hit-area text-ink underline decoration-ink/40 underline-offset-4 hover:decoration-ink"
            >
              Repository di ron1nOS
            </a>
          </li>
          <li>
            <a
              href={SPEC_URL}
              target="_blank"
              rel="noreferrer"
              className="hit-area text-ink underline decoration-ink/40 underline-offset-4 hover:decoration-ink"
            >
              Specifica delle impostazioni
            </a>
          </li>
        </ul>
      </WidgetCard>
    </>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 border-t border-glass-border first:border-t-0">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="m-0 text-sm">{children}</dd>
    </div>
  )
}

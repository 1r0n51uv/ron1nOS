import { StatusDot, WidgetCard } from '@/components/ron1n'
import { Button } from '@/components/ui/button'
import { time } from '@/lib/format'
import type { Integration } from './data'
import { useCheckIntegration, useIntegrations } from './data'

const STATE_LABELS: Record<Integration['state'], string> = {
  connected: 'collegato',
  error: 'errore',
  not_configured: 'non configurato',
}

// Impostazioni › Integrazioni (SET-009): una riga per servizio esterno,
// con stato, ultimo controllo e `Verifica`. I segreti restano nel .env.
export function IntegrationsSection() {
  const { data, isError } = useIntegrations()
  const check = useCheckIntegration()

  return (
    <WidgetCard title="Servizi esterni">
      <p className="m-0 text-sm text-ink-muted">
        Password e token stanno nel <span className="font-mono">.env</span> del server: qui solo lo stato.
      </p>
      {isError ? (
        <p role="alert" className="m-0 text-sm text-brand-text">
          Stato dei servizi non disponibile
        </p>
      ) : null}
      {data ? (
        <ul aria-label="Servizi esterni" className="m-0 flex list-none flex-col p-0">
          {data.map((it) => {
            const checking = check.isPending && check.variables === it.id
            return (
              <li
                key={it.id}
                aria-label={it.name}
                className="flex flex-col gap-2 border-t border-glass-border py-3.5 first:border-t-0"
              >
                <div className="flex items-center gap-3">
                  {it.state === 'not_configured' ? (
                    <span
                      aria-hidden="true"
                      className="size-2 shrink-0 rounded-full border border-ink-muted"
                    />
                  ) : (
                    <StatusDot tone={it.state === 'error' ? 'alert' : 'ok'} />
                  )}
                  <span className="text-sm font-semibold">{it.name}</span>
                  <span
                    className={it.state === 'error' ? 'text-sm text-brand-text' : 'text-sm text-ink-muted'}
                  >
                    {STATE_LABELS[it.state]}
                  </span>
                  <span className="ml-auto text-[13px] text-ink-muted">
                    controllato alle <span className="font-mono">{time(new Date(it.checkedAt))}</span>
                  </span>
                  <Button
                    variant="glass"
                    size="sm"
                    disabled={checking}
                    aria-label={`Verifica · ${it.name}`}
                    onClick={() => check.mutate(it.id)}
                  >
                    {checking ? 'Verifica…' : 'Verifica'}
                  </Button>
                </div>
                {it.message ? <p className="m-0 pl-5 text-[13px] text-ink-muted">{it.message}</p> : null}
                {it.env.length ? (
                  <p className="m-0 pl-5 text-[13px] text-ink-muted">
                    Da impostare nel <span className="font-mono">.env</span>:{' '}
                    {it.env.map((name, i) => (
                      <span key={name}>
                        {i ? ', ' : ''}
                        <code className="font-mono text-ink">{name}</code>
                      </span>
                    ))}
                  </p>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : null}
      {check.isError ? (
        <p role="alert" className="m-0 text-sm text-brand-text">
          Verifica non riuscita · riprova
        </p>
      ) : null}
    </WidgetCard>
  )
}

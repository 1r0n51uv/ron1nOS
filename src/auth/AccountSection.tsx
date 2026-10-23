import { useNavigate } from 'react-router'

import { WidgetCard } from '@/components/ron1n'
import { Button } from '@/components/ui/button'
import { AccessPanel } from './AccessPanel'
import { useCloseSessions, useMe, useSessions } from './data'

const when = (iso: string) =>
  new Date(iso).toLocaleString('it-IT', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

// Impostazioni › Account (SET-007): Esci, sessioni attive e come cambiare
// la password, che vive come hash nel .env (AUTH-002).
export function AccountSection() {
  const enabled = useMe().data?.enabled ?? false
  return (
    <>
      {enabled ? (
        <>
          <AccessPanel />
          <SessionsCard />
        </>
      ) : (
        <WidgetCard title="Login spento">
          <p className="m-0 text-sm text-ink-muted">
            Senza <span className="font-mono">AUTH_PASSWORD_HASH</span> nel{' '}
            <span className="font-mono">.env</span> la dashboard è aperta a chi è nella tailnet.
          </p>
        </WidgetCard>
      )}
      <WidgetCard title="Password">
        <p className="m-0 text-sm text-ink-muted">
          La password sta come hash nel <span className="font-mono">.env</span> del server, quindi non si
          cambia da qui. Per una nuova: sul server lancia il comando qui sotto, metti il risultato in{' '}
          <span className="font-mono">AUTH_PASSWORD_HASH</span> e riavvia lo stack.
        </p>
        <code className="block rounded-xl border border-glass-border bg-glass px-3.5 py-2.5 font-mono text-[13px]">
          npm run auth:hash
        </code>
      </WidgetCard>
    </>
  )
}

function SessionsCard() {
  const { data, isError } = useSessions(true)
  const close = useCloseSessions()
  const navigate = useNavigate()
  const others = data?.filter((s) => !s.current).length ?? 0

  return (
    <WidgetCard title="Sessioni attive" meta={data ? `${data.length}` : undefined}>
      {isError ? (
        <p role="alert" className="m-0 text-sm text-brand-text">
          Sessioni non disponibili
        </p>
      ) : null}
      {data ? (
        <ul aria-label="Sessioni attive" className="m-0 flex list-none flex-col p-0">
          {data.map((s) => (
            <li
              key={s.id}
              aria-label={s.device}
              className="flex items-center gap-4 border-t border-glass-border py-2.5 first:border-t-0"
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm">
                  {s.device}
                  {s.current ? <span className="text-ink-muted"> · questo browser</span> : null}
                </span>
                <span className="text-[13px] text-ink-muted">
                  ultimo uso <span className="font-mono">{when(s.lastSeenAt)}</span>
                </span>
              </div>
              <Button
                variant="glass"
                size="sm"
                aria-label={`Chiudi · ${s.device}${s.current ? ' · questo browser' : ''}`}
                disabled={close.one.isPending}
                onClick={() =>
                  close.one.mutate(s.id, {
                    onSuccess: () => (s.current ? navigate('/login', { replace: true }) : undefined),
                  })
                }
              >
                Chiudi
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <Button
        variant="glass"
        size="sm"
        className="self-start"
        disabled={others === 0 || close.others.isPending}
        onClick={() => close.others.mutate()}
      >
        Chiudi le altre sessioni
      </Button>
      {close.one.isError || close.others.isError ? (
        <p role="alert" className="m-0 text-sm text-brand-text">
          Sessione non chiusa · riprova
        </p>
      ) : null}
    </WidgetCard>
  )
}

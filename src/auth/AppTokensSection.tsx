import { useId, useState } from 'react'

import { WidgetCard } from '@/components/ron1n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useMe, useTokenActions, useTokens } from './data'

const when = (iso: string) =>
  new Date(iso).toLocaleString('it-IT', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

// Impostazioni › App iOS (SET-008): i token con cui l'app usa l'API
// (AUTH-005). Un token si vede una volta sola, appena creato.
export function AppTokensSection() {
  const enabled = useMe().data?.enabled ?? false
  if (!enabled) {
    return (
      <WidgetCard title="Login spento">
        <p className="m-0 text-sm text-ink-muted">
          Senza <span className="font-mono">AUTH_PASSWORD_HASH</span> l'API è aperta e l'app non ha bisogno di
          un token.
        </p>
      </WidgetCard>
    )
  }
  return (
    <>
      <NewTokenCard />
      <TokensCard />
    </>
  )
}

function NewTokenCard() {
  const [name, setName] = useState('iPhone')
  const [created, setCreated] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const { create } = useTokenActions()
  const fieldId = useId()

  const copy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(token)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <WidgetCard title="Nuovo token">
      <p className="m-0 text-sm text-ink-muted">
        Crea un token, copialo e incollalo nell'app iOS. Vale finché non lo revochi.
      </p>
      <form
        className="flex items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          setCopied(false)
          create.mutate(name.trim(), { onSuccess: (r) => setCreated(r.token) })
        }}
      >
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor={fieldId} className="text-[13px] text-ink-muted">
            Nome
          </label>
          <Input id={fieldId} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        </div>
        <Button type="submit" variant="glass" disabled={!name.trim() || create.isPending}>
          Crea token
        </Button>
      </form>
      {create.isError ? (
        <p role="alert" className="m-0 text-sm text-brand-text">
          Token non creato · riprova
        </p>
      ) : null}
      {created ? (
        <div className="flex flex-col gap-2">
          <span className="text-[13px] text-ink-muted">Copialo adesso · non si vedrà più</span>
          <div className="flex items-center gap-3">
            <code
              aria-label="Token appena creato"
              className="block min-w-0 flex-1 truncate rounded-xl border border-glass-border bg-glass px-3.5 py-2.5 font-mono text-[13px]"
            >
              {created}
            </code>
            <Button variant="glass" size="sm" onClick={() => void copy(created)}>
              {copied ? 'Copiato' : 'Copia'}
            </Button>
          </div>
        </div>
      ) : null}
    </WidgetCard>
  )
}

function TokensCard() {
  const { data, isError } = useTokens(true)
  const { revoke } = useTokenActions()

  return (
    <WidgetCard title="Token attivi" meta={data ? `${data.length}` : undefined}>
      {isError ? (
        <p role="alert" className="m-0 text-sm text-brand-text">
          Token non disponibili
        </p>
      ) : null}
      {data && data.length === 0 ? <p className="m-0 text-sm text-ink-muted">Nessun token</p> : null}
      {data && data.length > 0 ? (
        <ul aria-label="Token attivi" className="m-0 flex list-none flex-col p-0">
          {data.map((t) => (
            <li
              key={t.id}
              aria-label={t.name}
              className="flex items-center gap-4 border-t border-glass-border py-2.5 first:border-t-0"
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm">{t.name}</span>
                <span className="text-[13px] text-ink-muted">
                  creato <span className="font-mono">{when(t.createdAt)}</span> · ultimo uso{' '}
                  {t.lastUsedAt ? <span className="font-mono">{when(t.lastUsedAt)}</span> : 'mai'}
                </span>
              </div>
              <Button
                variant="glass"
                size="sm"
                aria-label={`Revoca · ${t.name}`}
                disabled={revoke.isPending}
                onClick={() => revoke.mutate(t.id)}
              >
                Revoca
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      {revoke.isError ? (
        <p role="alert" className="m-0 text-sm text-brand-text">
          Token non revocato · riprova
        </p>
      ) : null}
    </WidgetCard>
  )
}

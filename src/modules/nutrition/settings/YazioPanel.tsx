import { AlertRow, StatusPill, ToggleTile, WidgetCard } from '@/components/ron1n'
import { WidgetSkeleton } from '@/components/WidgetSkeleton'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api'
import { num, shortDay } from '@/lib/format'
import type { YazioLink } from '../data'
import { useSetYazioSync, useSyncYazio, useYazio } from '../data'
import { goalLine, whenLine } from '../format'

const errorText = (error: unknown) =>
  error instanceof ApiError ? error.message : error ? 'Backend non raggiungibile' : null

const STATE: Record<YazioLink['state'], string> = {
  connected: 'collegato',
  disconnected: 'non collegato',
  error: 'errore',
}

// Collegamento a YAZIO in Impostazioni (NUT-020): stato, ultima
// sincronizzazione, interruttore e Sincronizza ora. Le credenziali stanno
// solo nel .env del server.
export function YazioPanel() {
  const { data, error } = useYazio()
  const toggle = useSetYazioSync()
  const sync = useSyncYazio()

  if (!data && error) {
    return (
      <WidgetCard title="YAZIO">
        <AlertRow title="Stato di YAZIO non disponibile." body={errorText(error)!} />
      </WidgetCard>
    )
  }
  if (!data) return <WidgetSkeleton title="YAZIO" />

  const message = errorText(toggle.error ?? sync.error)
  return (
    <section aria-label="YAZIO">
      <WidgetCard title="YAZIO">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <StatusPill tone={data.state === 'error' ? 'alert' : 'ok'}>{STATE[data.state]}</StatusPill>
          </div>
          <div className="flex min-h-8 items-center justify-between gap-4 text-sm">
            <span>Ultima sincronizzazione</span>
            <span className="font-mono text-[13px] text-ink-muted">
              {data.lastSyncAt ? whenLine(data.lastSyncAt) : 'mai'}
            </span>
          </div>
          {data.state === 'error' && data.error ? (
            <AlertRow title="Sincronizzazione non riuscita." body={data.error} />
          ) : null}
          {data.configured ? (
            <>
              <ToggleTile
                name="Sincronizzazione"
                meta={
                  data.syncEnabled
                    ? 'accesa · YAZIO ha la priorità nei conflitti'
                    : 'spenta · il diario resta in ron1nOS, nessun dato si perde'
                }
                on={data.syncEnabled}
                onChange={(next) => toggle.mutate(next)}
              />
              <div className="flex items-center gap-3">
                <Button
                  variant="glass"
                  size="sm"
                  disabled={!data.syncEnabled || sync.isPending}
                  onClick={() => sync.mutate(undefined)}
                >
                  {sync.isPending ? 'Sincronizzo…' : 'Sincronizza ora'}
                </Button>
                <span className="text-xs text-ink-muted">Credenziali nel file .env del server.</span>
              </div>
            </>
          ) : (
            <p className="m-0 text-[13px] text-ink-muted">
              Per collegarlo servono le variabili YAZIO_* nel file .env del server. Se entri in YAZIO con
              Apple o Google, imposta prima una password nell’app YAZIO.
            </p>
          )}
          {message ? <AlertRow title="Richiesta non riuscita." body={message} /> : null}
          {data.configured ? <Imported imported={data.imported} /> : null}
        </div>
      </WidgetCard>
    </section>
  )
}

// Obiettivo, attività e peso letti da YAZIO (NUT-024): qui solo si leggono.
function Imported({ imported: { goal, activityKcal, weight } }: { imported: YazioLink['imported'] }) {
  const rows = [
    goal ? ['Obiettivo', goalLine(goal)] : null,
    goal?.waterMl != null ? ['Acqua', `${num(goal.waterMl)} ml`] : null,
    activityKcal != null ? ['Attività di oggi', `+${num(activityKcal)} kcal`] : null,
    weight ? ['Peso', `${num(weight.kg, 1)} kg · ${shortDay(weight.day)}`] : null,
  ].filter((r) => r !== null)
  return (
    <div aria-label="Da YAZIO" role="group" className="flex flex-col border-t border-glass-border pt-3">
      <div className="flex items-baseline justify-between gap-4">
        <span className="eyebrow">Da YAZIO</span>
        <span className="text-xs text-ink-muted">si modificano nell’app YAZIO</span>
      </div>
      {rows.length ? (
        rows.map(([label, value]) => (
          <div key={label} className="flex min-h-8 items-center justify-between gap-4 text-sm">
            <span>{label}</span>
            <span className="font-mono text-[13px]">{value}</span>
          </div>
        ))
      ) : (
        <span className="mt-2 text-[13px] text-ink-muted">Niente ancora: arriva con il primo giro.</span>
      )}
    </div>
  )
}

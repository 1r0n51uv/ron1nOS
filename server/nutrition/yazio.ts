// Collegamento all'account YAZIO (NUT-020): stato, interruttore della
// sincronizzazione e un giro di sincronizzazione. Le credenziali stanno nel
// .env del server; qui arrivano solo lo stato e il motivo di un errore.
import type { Queryable } from '../db.ts'
import type { YazioClient } from '../yazio/client.ts'
import {
  YazioAuthError,
  YazioError,
  YazioFormatError,
  YazioRateLimitError,
  YazioRequestError,
  YazioServerError,
  YazioUnreachableError,
} from '../yazio/client.ts'
import { today } from './dates.ts'

export type YazioState = 'connected' | 'disconnected' | 'error'

export type YazioLink = {
  // false: mancano le variabili YAZIO_* nel .env del server.
  configured: boolean
  state: YazioState
  error: string | null
  lastSyncAt: string | null
  syncEnabled: boolean
}

// Un passo del giro: lettura (NUT-022) e invio (NUT-023) si aggiungono qui.
export type SyncStep = (ctx: { db: Queryable; client: YazioClient; day: string }) => Promise<void>

// Finché lettura e invio non ci sono, il giro verifica solo l'accesso.
export const checkConnection: SyncStep = async ({ client, day }) => {
  await client.water(day)
}

type Row = {
  sync_enabled: boolean
  last_sync_at: Date | null
  last_error: string | null
  has_token: boolean
}

export async function yazioLink(db: Queryable, configured: boolean): Promise<YazioLink> {
  const { rows } = await db.query<Row>(
    `select coalesce(s.sync_enabled, true) as sync_enabled, s.last_sync_at, s.last_error,
            exists (select 1 from yazio_tokens) as has_token
       from (select 1) one left join yazio_status s on s.id = 1`,
  )
  const row = rows[0]!
  const lastSyncAt = row.last_sync_at?.toISOString() ?? null
  const base = { configured, lastSyncAt, syncEnabled: row.sync_enabled }
  if (!configured) return { ...base, state: 'disconnected', error: null }
  if (row.last_error) return { ...base, state: 'error', error: row.last_error }
  return { ...base, state: row.has_token || lastSyncAt ? 'connected' : 'disconnected', error: null }
}

// Spegnere la sincronizzazione non tocca né i dati né i token.
export async function setSyncEnabled(db: Queryable, enabled: boolean) {
  await db.query(
    `insert into yazio_status (id, sync_enabled) values (1, $1)
     on conflict (id) do update set sync_enabled = excluded.sync_enabled`,
    [enabled],
  )
}

export async function syncEnabled(db: Queryable) {
  const { rows } = await db.query<{ on: boolean }>('select sync_enabled as on from yazio_status where id = 1')
  return rows[0]?.on ?? true
}

// Un giro: i passi in ordine, il primo errore ferma il giro e diventa il
// motivo mostrato in Impostazioni.
export async function runSync(
  db: Queryable,
  client: YazioClient,
  { steps = [checkConnection], now = new Date() }: { steps?: SyncStep[]; now?: Date } = {},
) {
  try {
    for (const step of steps) await step({ db, client, day: today(now) })
  } catch (err) {
    if (!(err instanceof Error)) throw err
    if (!(err instanceof YazioError)) console.warn(`sincronizzazione YAZIO non riuscita: ${err.message}`)
    await db.query(
      `insert into yazio_status (id, last_error, last_error_at) values (1, $1, $2)
       on conflict (id) do update set last_error = excluded.last_error, last_error_at = excluded.last_error_at`,
      [reason(err), now],
    )
    return false
  }
  await db.query(
    `insert into yazio_status (id, last_sync_at) values (1, $1)
     on conflict (id) do update set last_sync_at = excluded.last_sync_at, last_error = null,
       last_error_at = null`,
    [now],
  )
  return true
}

// Il motivo dell'errore, in italiano, da mostrare così com'è.
export function reason(err: Error) {
  if (err instanceof YazioAuthError) {
    return "YAZIO ha rifiutato email o password del .env. Se entri con Apple o Google, imposta prima una password nell'app YAZIO."
  }
  if (err instanceof YazioRateLimitError)
    return 'YAZIO ha chiesto di rallentare: si riprova al prossimo giro.'
  if (err instanceof YazioServerError) return `YAZIO ha un problema (errore ${err.status}).`
  if (err instanceof YazioUnreachableError) return 'YAZIO non raggiungibile.'
  if (err instanceof YazioFormatError)
    return "Le risposte di YAZIO sono cambiate: va aggiornato l'adattatore."
  if (err instanceof YazioRequestError) return `YAZIO ha rifiutato una richiesta (errore ${err.status}).`
  return 'Errore inatteso durante la sincronizzazione.'
}

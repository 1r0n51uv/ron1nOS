// Collegamento all'account YAZIO (NUT-020): stato, interruttore della
// sincronizzazione e un giro di sincronizzazione. Le credenziali stanno nel
// .env del server; qui arrivano solo lo stato e il motivo di un errore.
import type { Db, Queryable } from '../db.ts'
import type { YazioClient } from '../yazio/client.ts'
import {
  YazioAuthError,
  YazioError,
  YazioFormatError,
  YazioRateLimitError,
  YazioRequestError,
  YazioServerError,
  YazioUnreachableError,
  YazioVersionError,
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

// Un passo del giro: obiettivo, attività e peso (NUT-024), poi diario
// (NUT-022) e invio (NUT-023).
export type SyncStep = (ctx: { db: Db; client: YazioClient; day: string }) => Promise<void>

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
  db: Db,
  client: YazioClient,
  { steps, now = new Date() }: { steps: SyncStep[]; now?: Date },
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
    `insert into yazio_status (id, last_sync_at, first_sync_at) values (1, $1, $1)
     on conflict (id) do update set last_sync_at = excluded.last_sync_at, last_error = null,
       last_error_at = null, first_sync_at = coalesce(yazio_status.first_sync_at, excluded.first_sync_at)`,
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
  if (err instanceof YazioVersionError)
    return 'YAZIO non accetta più questa versione della sua API: cambia la versione in YAZIO_URL.'
  if (err instanceof YazioFormatError)
    return "Le risposte di YAZIO sono cambiate: va aggiornato l'adattatore."
  if (err instanceof YazioRequestError) return `YAZIO ha rifiutato una richiesta (errore ${err.status}).`
  return 'Errore inatteso durante la sincronizzazione.'
}

export type SyncRunner = ReturnType<typeof createSyncRunner>

// Chi fa i giri: Sincronizza ora e il giro ogni 15 minuti del backend
// (NUT-022). Un client per database, così il rinnovo del token resta uno
// solo, e un giro alla volta: chi arriva durante un giro aspetta quello.
export function createSyncRunner({
  yazio,
  steps,
  flushSteps = [],
  hasPending = async () => false,
  now = () => new Date(),
}: {
  yazio?: (db: Queryable) => YazioClient
  steps: SyncStep[]
  // L'invio di ogni minuto (NUT-023), solo se c'è qualcosa in coda.
  flushSteps?: SyncStep[]
  hasPending?: (db: Queryable, day: string) => Promise<boolean>
  now?: () => Date
}) {
  let current: { db: Db; client: YazioClient } | null = null
  let running: Promise<boolean> | null = null

  const client = (db: Db) => {
    if (!yazio) return null
    if (current?.db !== db) current = { db, client: yazio(db) }
    return current.client
  }

  const run = (db: Db, yc: YazioClient, list = steps) => {
    running ??= runSync(db, yc, { steps: list, now: now() }).finally(() => {
      running = null
    })
    return running
  }

  return {
    configured: !!yazio,
    client,
    run,
    // Il giro periodico: solo con YAZIO configurato e la sincronizzazione
    // accesa. null se non è partito.
    async tick(db: Db) {
      const yc = client(db)
      if (!yc || !(await syncEnabled(db))) return null
      return run(db, yc)
    },
    // L'invio entro un minuto: con YAZIO già collegato e qualcosa in coda.
    async flush(db: Db) {
      const yc = client(db)
      if (!yc || running) return null
      const link = await yazioLink(db, true)
      if (!link.syncEnabled || !link.lastSyncAt || !(await hasPending(db, today(now())))) return null
      return run(db, yc, flushSteps)
    },
  }
}

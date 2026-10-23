// Stato dei servizi esterni (SET-009): Postgres, YAZIO, qBittorrent,
// Glances, Home Assistant. Solo stato e messaggi scritti qui, mai password,
// token, indirizzi o errori grezzi: il messaggio si mostra così com'è.
import type { Database } from './db.ts'
import type { GlancesClient } from './glances.ts'
import type { SyncRunner } from './nutrition/yazio.ts'
import { syncEnabled, yazioLink } from './nutrition/yazio.ts'
import type { QbtClient } from './qbittorrent.ts'
import { QbtAuthError } from './qbittorrent.ts'

export const INTEGRATIONS = ['postgres', 'yazio', 'qbittorrent', 'glances', 'homeassistant'] as const
export type IntegrationId = (typeof INTEGRATIONS)[number]

export type IntegrationState = 'connected' | 'error' | 'not_configured'

export type Integration = {
  id: IntegrationId
  name: string
  state: IntegrationState
  message: string | null
  checkedAt: string
  // Le variabili del .env da impostare, solo per un servizio non configurato.
  env: string[]
}

type Result = Pick<Integration, 'state' | 'message'> & { env?: string[] }

const NAMES: Record<IntegrationId, string> = {
  postgres: 'Postgres',
  yazio: 'YAZIO',
  qbittorrent: 'qBittorrent',
  glances: 'Glances',
  homeassistant: 'Home Assistant',
}

const ok: Result = { state: 'connected', message: null }
const error = (message: string): Result => ({ state: 'error', message })

export type IntegrationDeps = {
  database: Database
  qbt: QbtClient
  glances?: GlancesClient
  yazio?: SyncRunner
  now?: () => Date
}

// Un controllo vale 30 secondi: più schede aperte non moltiplicano le chiamate.
const FRESH_MS = 30_000

export function createIntegrations({
  database,
  qbt,
  glances,
  yazio,
  now = () => new Date(),
}: IntegrationDeps) {
  const checks: Record<IntegrationId, (verify: boolean) => Promise<Result>> = {
    async postgres() {
      switch (database.status()) {
        case 'ok':
          return ok
        case 'disabled':
          return { state: 'not_configured', message: null, env: ['DATABASE_URL'] }
        case 'starting':
          return error('In avvio · migrazioni in corso')
        default:
          return error('Non raggiungibile')
      }
    },

    // Con `Verifica` si fa un giro di sincronizzazione, se è accesa.
    async yazio(verify) {
      if (!yazio?.configured) {
        return {
          state: 'not_configured',
          message: null,
          env: [
            'YAZIO_USERNAME',
            'YAZIO_PASSWORD',
            'YAZIO_CLIENT_ID',
            'YAZIO_CLIENT_SECRET',
            'YAZIO_TOKEN_KEY',
          ],
        }
      }
      const db = database.status() === 'ok' ? database.db : undefined
      if (!db) return error('Serve il database')
      if (verify && (await syncEnabled(db))) {
        const client = yazio.client(db)
        // L'esito del giro finisce nello stato del collegamento, letto qui sotto.
        if (client) await yazio.run(db, client).catch(() => undefined)
      }
      const link = await yazioLink(db, true)
      if (link.state === 'error') return error(link.error ?? 'Sincronizzazione non riuscita')
      if (link.state === 'connected') return ok
      return error('In attesa della prima sincronizzazione')
    },

    async qbittorrent() {
      try {
        await qbt.transferInfo()
        return ok
      } catch (err) {
        return err instanceof QbtAuthError
          ? error('Accesso rifiutato · controlla QBT_USERNAME e QBT_PASSWORD')
          : error('Non raggiungibile')
      }
    },

    async glances() {
      if (!glances) return { state: 'not_configured', message: null, env: ['GLANCES_URL'] }
      try {
        await glances.stats()
        return ok
      } catch {
        return error('Non raggiungibile')
      }
    },

    // Il modulo Casa non c'è ancora: niente da collegare per ora.
    async homeassistant() {
      return { state: 'not_configured', message: 'Arriva con il modulo Casa', env: [] }
    },
  }

  const last = new Map<IntegrationId, { at: number; value: Integration }>()

  async function check(id: IntegrationId, verify = false): Promise<Integration> {
    const at = now()
    const result = await checks[id](verify).catch(() => error('Controllo non riuscito'))
    const value: Integration = {
      id,
      name: NAMES[id],
      state: result.state,
      message: result.message,
      checkedAt: at.toISOString(),
      env: result.state === 'not_configured' ? (result.env ?? []) : [],
    }
    last.set(id, { at: at.getTime(), value })
    return value
  }

  return {
    // Tutti i servizi; quelli controllati da poco escono dalla memoria.
    list() {
      const t = now().getTime()
      return Promise.all(
        INTEGRATIONS.map((id) => {
          const cached = last.get(id)
          return cached && t - cached.at < FRESH_MS ? cached.value : check(id)
        }),
      )
    },
    // `Verifica`: di nuovo, subito.
    verify: (id: IntegrationId) => check(id, true),
  }
}

import { serve } from '@hono/node-server'

import { createApp } from './app.ts'
import { isPasswordHash } from './auth/password.ts'
import { loadConfig } from './config.ts'
import { createDb, startDatabase } from './db.ts'
import { createVault, parseKey } from './documents/crypto.ts'
import { createDraftService } from './drafts.ts'
import { createGlancesClient } from './glances.ts'
import { createExternalSearch } from './nutrition/foodsearch.ts'
import { hasPending } from './nutrition/diarywrite.ts'
import { FLUSH_STEPS, SYNC_STEPS } from './nutrition/fromyazio.ts'
import { createSyncRunner } from './nutrition/yazio.ts'
import { createQbtClient } from './qbittorrent.ts'
import { createYazioClient } from './yazio/client.ts'
import { dbTokenStore } from './yazio/tokens.ts'

const config = loadConfig()
if (!config.qbt.username || !config.qbt.password) {
  console.warn('QBT_USERNAME o QBT_PASSWORD mancanti: il modulo Download risponderà con errore di accesso')
}

if (!config.auth.passwordHash) {
  console.warn('AUTH_PASSWORD_HASH mancante: login spento, la dashboard è aperta a chi è nella tailnet')
} else if (!isPasswordHash(config.auth.passwordHash)) {
  console.warn('AUTH_PASSWORD_HASH non valido: rigeneralo con npm run auth:hash')
}

const documentsKey = parseKey(config.documentsKey)
if (!documentsKey) {
  console.warn('DOCUMENTS_KEY mancante o non di 32 byte: il modulo Documenti resta spento')
} else if (!config.auth.passwordHash) {
  console.warn('il modulo Documenti resta spento finché il login non è acceso')
}

if (!config.databaseUrl) console.warn('DATABASE_URL mancante: il modulo Nutrizione risponderà con errore')
const database = startDatabase(config.databaseUrl ? createDb(config.databaseUrl) : undefined)

const { yazio } = config
if (!yazio) console.warn('variabili YAZIO_* mancanti: il diario resta solo in ron1nOS')

const sync = createSyncRunner({
  yazio: yazio && ((db) => createYazioClient({ ...yazio, tokens: dbTokenStore(db, yazio.tokenKey) })),
  steps: SYNC_STEPS,
  flushSteps: FLUSH_STEPS,
  hasPending,
})

const qbt = createQbtClient(config.qbt)
const drafts = createDraftService({ qbt, metadataWaitMs: config.metadataWaitMs })
const app = createApp({
  qbt,
  drafts,
  glances: createGlancesClient(config.glances),
  staticDir: config.staticDir,
  database,
  nutrition: { external: createExternalSearch(config.foods), sync },
  auth: config.auth,
  documents: { vault: documentsKey ? createVault(documentsKey) : undefined },
})

// Bozze orfane del wizard: all'avvio e ogni ora.
function sweep() {
  drafts
    .sweepOrphans()
    .then((n) => n && console.log(`tolte ${n} bozze orfane da qBittorrent`))
    .catch((err: Error) => console.warn(`pulizia delle bozze non riuscita: ${err.message}`))
}
sweep()
setInterval(sweep, 60 * 60_000).unref()

// Sincronizzazione con YAZIO ogni 15 minuti (NUT-022); l'esito finisce in
// Impostazioni, qui solo gli errori inattesi.
function syncYazio() {
  if (database.status() !== 'ok' || !database.db) return
  sync.tick(database.db).catch((err: Error) => console.warn(`giro YAZIO non riuscito: ${err.message}`))
}
// Le righe nuove o cambiate partono entro un minuto (NUT-023).
function flushYazio() {
  if (database.status() !== 'ok' || !database.db) return
  sync.flush(database.db).catch((err: Error) => console.warn(`invio a YAZIO non riuscito: ${err.message}`))
}
if (yazio) {
  setTimeout(syncYazio, 30_000).unref()
  setInterval(syncYazio, 15 * 60_000).unref()
  setInterval(flushYazio, 60_000).unref()
}

const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`ron1nOS in ascolto sulla porta ${info.port}`)
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () =>
    server.close(() => {
      void (database.db?.end() ?? Promise.resolve()).finally(() => process.exit(0))
    }),
  )
}

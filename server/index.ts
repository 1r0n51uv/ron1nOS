import { setDefaultAutoSelectFamilyAttemptTimeout } from 'node:net'

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
import { isModuleDisabled } from './preferences/modules.ts'
import { createQbtClient } from './qbittorrent.ts'
import { createCatalog } from './workout/catalog.ts'
import { createYazioClient } from './yazio/client.ts'
import { dbTokenStore } from './yazio/tokens.ts'

// Node prova ogni indirizzo per 250 ms: dal server l'IPv6 non va e l'IPv4
// di USDA risponde più lento, così la ricerca andava in timeout in mezzo
// secondo (prova del 2026-10-23). Con 2 s per indirizzo risponde.
setDefaultAutoSelectFamilyAttemptTimeout(2_000)

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

// Catalogo delle immagini degli esercizi: si scarica in background al primo
// avvio, senza fermare il resto del backend.
const catalog = createCatalog(config.workoutCatalog)
void catalog.ready()

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
  workout: { catalog },
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
// Con il modulo Nutrizione spento (SET-005) i giri si fermano.
async function nutritionOn() {
  if (database.status() !== 'ok' || !database.db) return null
  return (await isModuleDisabled(database.db, 'nutrition')) ? null : database.db
}
function syncYazio() {
  nutritionOn()
    .then((db) => db && sync.tick(db))
    .catch((err: Error) => console.warn(`giro YAZIO non riuscito: ${err.message}`))
}
// Le righe nuove o cambiate partono entro un minuto (NUT-023).
function flushYazio() {
  nutritionOn()
    .then((db) => db && sync.flush(db))
    .catch((err: Error) => console.warn(`invio a YAZIO non riuscito: ${err.message}`))
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

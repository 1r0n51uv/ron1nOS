import { serve } from '@hono/node-server'

import { createApp } from './app.ts'
import { loadConfig } from './config.ts'
import { createDraftService } from './drafts.ts'
import { createGlancesClient } from './glances.ts'
import { createQbtClient } from './qbittorrent.ts'

const config = loadConfig()
if (!config.qbt.username || !config.qbt.password) {
  console.warn('QBT_USERNAME o QBT_PASSWORD mancanti: il modulo Download risponderà con errore di accesso')
}

const qbt = createQbtClient(config.qbt)
const drafts = createDraftService({ qbt, metadataWaitMs: config.metadataWaitMs })
const app = createApp({
  qbt,
  drafts,
  glances: createGlancesClient(config.glances),
  staticDir: config.staticDir,
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

const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`ron1nOS in ascolto sulla porta ${info.port}`)
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)))
}

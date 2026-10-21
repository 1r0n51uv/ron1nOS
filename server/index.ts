import { serve } from '@hono/node-server'

import { createApp } from './app.ts'
import { loadConfig } from './config.ts'
import { createQbtClient } from './qbittorrent.ts'

const config = loadConfig()
if (!config.qbt.username || !config.qbt.password) {
  console.warn('QBT_USERNAME o QBT_PASSWORD mancanti: il modulo Download risponderà con errore di accesso')
}

const app = createApp({ qbt: createQbtClient(config.qbt), staticDir: config.staticDir })
const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`ron1nOS in ascolto sulla porta ${info.port}`)
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)))
}

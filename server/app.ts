// Il backend di ron1nOS: API JSON sotto /api/v1 per la dashboard e la
// futura app iOS, più i file statici della build (SPA).
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'

import { toDownloads } from './downloads.ts'
import type { QbtClient } from './qbittorrent.ts'
import { QbtAuthError, QbtUnreachableError } from './qbittorrent.ts'

export type ApiError = { error: string; message: string }

type Deps = { qbt: QbtClient; staticDir?: string }

export function createApp({ qbt, staticDir }: Deps) {
  const app = new Hono()

  app.get('/api/v1/health', (c) => c.json({ ok: true }))

  app.get('/api/v1/downloads', async (c) => {
    const [transfer, torrents] = await Promise.all([qbt.transferInfo(), qbt.torrents()])
    return c.json(toDownloads(transfer, torrents))
  })

  app.all('/api/*', (c) => c.json<ApiError>({ error: 'not_found', message: 'Rotta non trovata' }, 404))

  app.onError((err, c) => {
    if (err instanceof QbtUnreachableError) {
      return c.json<ApiError>(
        { error: 'qbittorrent_unreachable', message: 'qBittorrent non raggiungibile' },
        503,
      )
    }
    if (err instanceof QbtAuthError) {
      return c.json<ApiError>(
        { error: 'qbittorrent_auth', message: 'Accesso a qBittorrent non riuscito' },
        502,
      )
    }
    console.error(err)
    return c.json<ApiError>({ error: 'internal', message: 'Errore interno' }, 500)
  })

  if (staticDir) {
    app.use(
      '*',
      serveStatic({
        root: staticDir,
        onFound: (path, c) => {
          if (path.includes('/assets/')) c.header('Cache-Control', 'public, max-age=31536000, immutable')
        },
      }),
    )
    // SPA: ogni percorso sconosciuto torna a index.html.
    app.get('*', serveStatic({ root: staticDir, rewriteRequestPath: () => '/index.html' }))
  }

  return app
}

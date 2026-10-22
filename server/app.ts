// Il backend di ron1nOS: API JSON sotto /api/v1 per la dashboard e la
// futura app iOS, più i file statici della build (SPA).
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'

import type { Database } from './db.ts'
import { DatabaseUnavailableError } from './db.ts'
import type { DraftService } from './drafts.ts'
import {
  createDraftService,
  DraftNotFoundError,
  DuplicateTorrentError,
  InsufficientSpaceError,
  InvalidMagnetError,
  InvalidSelectionError,
  StartFailedError,
} from './drafts.ts'
import { toDownloads } from './downloads.ts'
import { fetchTorrent as defaultFetchTorrent, TorrentFetchError } from './fetch-torrent.ts'
import type { GlancesClient } from './glances.ts'
import { GlancesUnreachableError } from './glances.ts'
import type { QbtClient } from './qbittorrent.ts'
import { QbtAuthError, QbtUnreachableError } from './qbittorrent.ts'
import { InvalidTorrentError, MAX_TORRENT_BYTES, parseTorrent } from './torrentfile.ts'

export type ApiError = {
  error: string
  message: string
  torrent?: { name: string; state: string }
  needed?: number
  free?: number
}

type Deps = {
  qbt: QbtClient
  staticDir?: string
  drafts?: DraftService
  glances?: GlancesClient
  fetchTorrent?: (url: string) => Promise<Buffer>
  database?: Database
}

class InvalidLinkError extends Error {}

export function createApp({
  qbt,
  staticDir,
  drafts = createDraftService({ qbt }),
  glances,
  fetchTorrent = defaultFetchTorrent,
  database = { status: () => 'disabled' },
}: Deps) {
  const app = new Hono()

  // ok resta true anche senza database: il resto della dashboard funziona.
  app.get('/api/v1/health', (c) => c.json({ ok: true, database: database.status() }))

  app.get('/api/v1/downloads', async (c) => {
    const [transfer, torrents] = await Promise.all([qbt.transferInfo(), qbt.torrents()])
    return c.json(toDownloads(transfer, torrents))
  })

  // Crea una bozza da un file .torrent (multipart, campo `file`) o da un
  // link (JSON `{ link }`): URL http(s) di un .torrent o magnet.
  app.post(
    '/api/v1/downloads/drafts',
    bodyLimit({
      maxSize: MAX_TORRENT_BYTES + 64 * 1024,
      onError: () => {
        throw new InvalidTorrentError()
      },
    }),
    async (c) => {
      const type = c.req.header('content-type') ?? ''
      if (type.startsWith('multipart/form-data')) {
        const body = await c.req.parseBody()
        const file = body.file
        if (!(file instanceof File)) throw new InvalidTorrentError()
        const torrent = Buffer.from(await file.arrayBuffer())
        return c.json(await drafts.fromTorrent('file', torrent), 201)
      }
      const body = await c.req.json<{ link?: unknown }>().catch(() => ({ link: undefined }))
      const link = typeof body.link === 'string' ? body.link.trim() : ''
      if (/^magnet:/i.test(link)) return c.json(await drafts.fromMagnet(link), 201)
      if (!/^https?:\/\//i.test(link)) throw new InvalidLinkError()
      const torrent = await fetchTorrent(link)
      let meta
      try {
        meta = parseTorrent(torrent)
      } catch (err) {
        // Dall'URL è arrivato qualcosa che non è un torrent.
        if (err instanceof InvalidTorrentError) throw new TorrentFetchError('non è un torrent')
        throw err
      }
      return c.json(await drafts.fromTorrent('url', torrent, meta), 201)
    },
  )

  // Con un magnet: interrogata dal wizard finché i metadati non arrivano.
  app.get('/api/v1/downloads/drafts/:id', async (c) => c.json(await drafts.get(c.req.param('id'))))

  // Avvio con i file scelti (indici di DraftFile).
  app.post('/api/v1/downloads/drafts/:id/start', async (c) => {
    const body = await c.req.json<{ files?: unknown }>().catch(() => ({ files: undefined }))
    const files =
      Array.isArray(body.files) && body.files.every(Number.isInteger) ? (body.files as number[]) : []
    return c.json(await drafts.start(c.req.param('id'), files))
  })

  app.delete('/api/v1/downloads/drafts/:id', async (c) => {
    await drafts.discard(c.req.param('id'))
    return c.body(null, 204)
  })

  // Spazio libero nella cartella predefinita di qBittorrent (DL-007).
  app.get('/api/v1/downloads/space', async (c) => {
    const [free, path] = await Promise.all([qbt.freeSpace(), qbt.defaultSavePath()])
    return c.json({ free, path })
  })

  app.post('/api/v1/downloads/drafts/:id/retry', async (c) => c.json(await drafts.retry(c.req.param('id'))))

  // Modulo Server (docs/specs/server.md): sola lettura da Glances.
  app.get('/api/v1/server/stats', async (c) => {
    if (!glances) throw new GlancesUnreachableError('Glances non configurato')
    return c.json(await glances.stats())
  })

  app.all('/api/*', (c) => c.json<ApiError>({ error: 'not_found', message: 'Rotta non trovata' }, 404))

  app.onError((err, c) => {
    if (err instanceof QbtUnreachableError) {
      return c.json<ApiError>(
        { error: 'qbittorrent_unreachable', message: 'qBittorrent non raggiungibile' },
        503,
      )
    }
    if (err instanceof DatabaseUnavailableError) {
      console.warn(`database non raggiungibile: ${err.message}`)
      return c.json<ApiError>({ error: 'database_unavailable', message: 'Database non raggiungibile' }, 503)
    }
    if (err instanceof GlancesUnreachableError) {
      return c.json<ApiError>({ error: 'glances_unreachable', message: 'Glances non raggiungibile' }, 503)
    }
    if (err instanceof QbtAuthError) {
      return c.json<ApiError>(
        { error: 'qbittorrent_auth', message: 'Accesso a qBittorrent non riuscito' },
        502,
      )
    }
    if (err instanceof InvalidTorrentError) {
      return c.json<ApiError>({ error: 'invalid_torrent', message: 'File torrent non valido' }, 400)
    }
    if (err instanceof InvalidLinkError || err instanceof InvalidMagnetError) {
      return c.json<ApiError>({ error: 'invalid_link', message: 'Link non valido' }, 400)
    }
    if (err instanceof TorrentFetchError) {
      return c.json<ApiError>(
        { error: 'torrent_fetch_failed', message: 'Impossibile scaricare il file torrent' },
        422,
      )
    }
    if (err instanceof DraftNotFoundError) {
      return c.json<ApiError>({ error: 'draft_not_found', message: 'Bozza non trovata' }, 404)
    }
    if (err instanceof DuplicateTorrentError) {
      return c.json<ApiError>(
        { error: 'duplicate', message: 'Questo torrent è già nei download', torrent: err.torrent },
        409,
      )
    }
    if (err instanceof InvalidSelectionError) {
      return c.json<ApiError>({ error: 'invalid_selection', message: 'Scegli almeno un file' }, 400)
    }
    if (err instanceof InsufficientSpaceError) {
      return c.json<ApiError>(
        { error: 'insufficient_space', message: 'Spazio insufficiente', needed: err.needed, free: err.free },
        409,
      )
    }
    if (err instanceof StartFailedError) {
      console.warn(`avvio non riuscito: ${err.message}`)
      return c.json<ApiError>({ error: 'start_failed', message: 'Avvio non riuscito' }, 502)
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

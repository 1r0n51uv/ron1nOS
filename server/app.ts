// Il backend di ron1nOS: API JSON sotto /api/v1 per la dashboard e la
// futura app iOS, più i file statici della build (SPA).
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'

import type { DraftStore } from './drafts.ts'
import { createDraftStore } from './drafts.ts'
import { toDownloads } from './downloads.ts'
import { fetchTorrent as defaultFetchTorrent, TorrentFetchError } from './fetch-torrent.ts'
import type { QbtClient } from './qbittorrent.ts'
import { QbtAuthError, QbtUnreachableError } from './qbittorrent.ts'
import { InvalidTorrentError, MAX_TORRENT_BYTES, parseTorrent } from './torrentfile.ts'

export type ApiError = { error: string; message: string }

type Deps = {
  qbt: QbtClient
  staticDir?: string
  drafts?: DraftStore
  fetchTorrent?: (url: string) => Promise<Buffer>
}

class InvalidLinkError extends Error {}

// Link magnet v1 (btih) o v2 (btmh), come nel passo 1 del wizard.
export const MAGNET = /^magnet:\?.*\bxt=urn:bt(ih|mh):/i

export function createApp({
  qbt,
  staticDir,
  drafts = createDraftStore(),
  fetchTorrent = defaultFetchTorrent,
}: Deps) {
  const app = new Hono()

  app.get('/api/v1/health', (c) => c.json({ ok: true }))

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
        return c.json(drafts.add('file', parseTorrent(torrent), torrent), 201)
      }
      const body = await c.req.json<{ link?: unknown }>().catch(() => ({ link: undefined }))
      const link = typeof body.link === 'string' ? body.link.trim() : ''
      if (MAGNET.test(link)) {
        return c.json<ApiError>({ error: 'not_implemented', message: 'Magnet non ancora supportati' }, 501)
      }
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
      return c.json(drafts.add('url', meta, torrent), 201)
    },
  )

  app.get('/api/v1/downloads/drafts/:id', (c) => {
    const entry = drafts.get(c.req.param('id'))
    if (!entry) return c.json<ApiError>({ error: 'draft_not_found', message: 'Bozza non trovata' }, 404)
    return c.json(entry.draft)
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
    if (err instanceof InvalidTorrentError) {
      return c.json<ApiError>({ error: 'invalid_torrent', message: 'File torrent non valido' }, 400)
    }
    if (err instanceof InvalidLinkError) {
      return c.json<ApiError>({ error: 'invalid_link', message: 'Link non valido' }, 400)
    }
    if (err instanceof TorrentFetchError) {
      return c.json<ApiError>(
        { error: 'torrent_fetch_failed', message: 'Impossibile scaricare il file torrent' },
        422,
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

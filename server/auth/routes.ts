// Login della dashboard (docs/specs/auth.md): una sola password, sessioni
// in Postgres, cookie HttpOnly. Senza AUTH_PASSWORD_HASH il login è spento
// e la dashboard resta aperta a chi è nella tailnet, come prima.
import type { Context, MiddlewareHandler } from 'hono'
import { Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { getConnInfo } from '@hono/node-server/conninfo'
import { z } from 'zod'

import type { Database } from '../db.ts'
import { createLoginLimiter, type LoginLimiter } from './limiter.ts'
import { verifyPassword } from './password.ts'
import {
  createSession,
  deleteAllSessions,
  deleteOtherSessions,
  deleteSession,
  deleteSessionById,
  isCurrentSession,
  listSessions,
  purgeExpired,
  touchSession,
} from './sessions.ts'
import { createToken, deleteToken, listTokens, checkToken } from './tokens.ts'

export const SESSION_COOKIE = 'ron1nos_session'

export type AuthDeps = {
  // Hash scrypt della password; undefined = login spento.
  passwordHash?: string
  database: Database
  // false solo negli e2e su http://localhost.
  cookieSecure?: boolean
  limiter?: LoginLimiter
}

// Raggiungibili senza sessione.
const PUBLIC = new Set(['GET /api/v1/health', 'POST /api/v1/auth/login'])
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

const loginBody = z.object({ password: z.string().min(1).max(1024) })
const tokenBody = z.object({ name: z.string().trim().min(1).max(60) })

const unauthenticated = (c: Context) =>
  c.json({ error: 'unauthenticated', message: 'Accesso richiesto' }, 401)
const dbUnavailable = (c: Context) =>
  c.json({ error: 'database_unavailable', message: 'Database non raggiungibile' }, 503)

// Caddy mette l'indirizzo del client in X-Forwarded-For; senza proxy vale
// quello della connessione.
function clientIp(c: Context) {
  const forwarded = c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
  if (forwarded) return forwarded
  try {
    return getConnInfo(c).remote.address ?? 'sconosciuto'
  } catch {
    return 'sconosciuto'
  }
}

// Una richiesta che cambia dati da un'altra origine viene rifiutata. I
// client senza Origin (app iOS, curl) passano: il cookie SameSite=Strict
// fa già il resto.
function sameOrigin(c: Context) {
  const origin = c.req.header('origin')
  if (!origin) return true
  try {
    return new URL(origin).host === c.req.header('host')
  } catch {
    return false
  }
}

export function createAuth({
  passwordHash,
  database,
  cookieSecure = true,
  limiter = createLoginLimiter(),
}: AuthDeps) {
  const enabled = Boolean(passwordHash)

  const writeCookie = (c: Context, token: string, expiresAt: Date) =>
    setCookie(c, SESSION_COOKIE, token, {
      httpOnly: true,
      secure: cookieSecure,
      sameSite: 'Strict',
      path: '/',
      expires: expiresAt,
    })
  const clearCookie = (c: Context) =>
    deleteCookie(c, SESSION_COOKIE, { path: '/', secure: cookieSecure, httpOnly: true, sameSite: 'Strict' })

  const middleware: MiddlewareHandler = async (c, next) => {
    if (!enabled || PUBLIC.has(`${c.req.method} ${c.req.path}`)) return next()
    // Token dell'app iOS (AUTH-005): vale come una sessione. Un token
    // sbagliato è un 401, senza ripiegare sul cookie.
    const bearer = c.req.header('authorization')?.match(/^Bearer (.+)$/)?.[1]
    if (bearer) {
      const db = database.db
      if (!db || database.status() !== 'ok') return dbUnavailable(c)
      return (await checkToken(db, bearer)) ? next() : unauthenticated(c)
    }
    if (!SAFE_METHODS.has(c.req.method) && !sameOrigin(c)) {
      return c.json({ error: 'forbidden_origin', message: 'Origine non permessa' }, 403)
    }
    const token = getCookie(c, SESSION_COOKIE)
    if (!token) return unauthenticated(c)
    const db = database.db
    if (!db || database.status() !== 'ok') return dbUnavailable(c)
    const session = await touchSession(db, token)
    if (!session) {
      clearCookie(c)
      return unauthenticated(c)
    }
    if (session.renewed) writeCookie(c, token, session.expiresAt)
    return next()
  }

  const routes = new Hono()

  routes.post('/login', async (c) => {
    if (!enabled) return c.json({ error: 'auth_disabled', message: 'Login non attivo' }, 409)
    const ip = clientIp(c)
    const wait = limiter.blockedFor(ip)
    if (wait > 0) {
      const minutes = Math.ceil(wait / 60_000)
      c.header('Retry-After', String(Math.ceil(wait / 1000)))
      return c.json(
        {
          error: 'too_many_attempts',
          message: `Troppi tentativi. Riprova tra ${minutes} ${minutes === 1 ? 'minuto' : 'minuti'}.`,
        },
        429,
      )
    }
    const parsed = loginBody.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success || !(await verifyPassword(parsed.data.password, passwordHash!))) {
      limiter.fail(ip)
      console.warn(`login non riuscito da ${ip}`)
      return c.json({ error: 'invalid_password', message: 'Password non valida' }, 401)
    }
    const db = database.db
    if (!db || database.status() !== 'ok') return dbUnavailable(c)
    limiter.reset(ip)
    await purgeExpired(db)
    const { token, expiresAt } = await createSession(db, c.req.header('user-agent'))
    writeCookie(c, token, expiresAt)
    return c.json({ enabled: true, expiresAt: expiresAt.toISOString() })
  })

  routes.post('/logout', async (c) => {
    const token = getCookie(c, SESSION_COOKIE)
    if (enabled && token && database.db) await deleteSession(database.db, token)
    clearCookie(c)
    return c.body(null, 204)
  })

  // Il middleware ha già controllato la sessione: qui si dice solo se il
  // login è attivo.
  routes.get('/me', (c) => c.json({ enabled }))

  // Sessioni attive (SET-007), la più recente prima; con il login spento
  // l'elenco è vuoto.
  routes.get('/sessions', async (c) => {
    if (!enabled || !database.db) return c.json({ sessions: [] })
    return c.json({ sessions: await listSessions(database.db, getCookie(c, SESSION_COOKIE)) })
  })

  // Chiudi le altre sessioni: resta solo questa.
  routes.delete('/sessions/others', async (c) => {
    const token = getCookie(c, SESSION_COOKIE)
    if (enabled && token && database.db) await deleteOtherSessions(database.db, token)
    return c.body(null, 204)
  })

  // Chiudi una sessione; se è questa, si esce.
  routes.delete('/sessions/:id', async (c) => {
    const id = c.req.param('id')
    if (!enabled || !database.db || !(await deleteSessionById(database.db, id))) {
      return c.json({ error: 'not_found', message: 'Sessione non trovata' }, 404)
    }
    if (isCurrentSession(id, getCookie(c, SESSION_COOKIE))) clearCookie(c)
    return c.body(null, 204)
  })

  // Esci ovunque: chiude tutte le sessioni, compresa questa.
  routes.delete('/sessions', async (c) => {
    if (enabled && database.db) await deleteAllSessions(database.db)
    clearCookie(c)
    return c.body(null, 204)
  })

  // Token per l'app iOS (AUTH-005, SET-008). Il token si vede solo nella
  // risposta che lo crea.
  routes.get('/tokens', async (c) => {
    if (!enabled || !database.db) return c.json({ tokens: [] })
    return c.json({ tokens: await listTokens(database.db) })
  })

  routes.post('/tokens', async (c) => {
    if (!enabled) return c.json({ error: 'auth_disabled', message: 'Login non attivo' }, 409)
    const parsed = tokenBody.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return c.json({ error: 'invalid_name', message: 'Serve un nome' }, 400)
    const db = database.db
    if (!db || database.status() !== 'ok') return dbUnavailable(c)
    return c.json(await createToken(db, parsed.data.name), 201)
  })

  routes.delete('/tokens/:id', async (c) => {
    if (!enabled || !database.db || !(await deleteToken(database.db, c.req.param('id')))) {
      return c.json({ error: 'not_found', message: 'Token non trovato' }, 404)
    }
    return c.body(null, 204)
  })

  return { enabled, middleware, routes }
}

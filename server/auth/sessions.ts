// Sessioni della dashboard (AUTH-002), in Postgres. Il cookie porta un id
// casuale da 32 byte; il database ne tiene solo l'hash. Durata 30 giorni,
// rinnovata a ogni uso.
import { createHash, randomBytes } from 'node:crypto'

import type { Queryable } from '../db.ts'

export const SESSION_DAYS = 30
const SESSION_MS = SESSION_DAYS * 24 * 60 * 60_000
// Il rinnovo scrive al più una volta ogni ora, non a ogni richiesta.
const RENEW_AFTER_MS = 60 * 60_000

const digest = (token: string) => createHash('sha256').update(token).digest('hex')

export type Session = { expiresAt: Date; renewed: boolean }

export async function createSession(db: Queryable, userAgent?: string, now = new Date()) {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(now.getTime() + SESSION_MS)
  await db.query(
    `insert into auth_sessions (token_hash, created_at, last_seen_at, expires_at, user_agent)
     values ($1, $2, $2, $3, $4)`,
    [digest(token), now, expiresAt, userAgent?.slice(0, 300) ?? null],
  )
  return { token, expiresAt }
}

// null se il token non esiste o è scaduto.
export async function touchSession(db: Queryable, token: string, now = new Date()): Promise<Session | null> {
  const { rows } = await db.query<{ last_seen_at: Date; expires_at: Date }>(
    'select last_seen_at, expires_at from auth_sessions where token_hash = $1 and expires_at > $2',
    [digest(token), now],
  )
  const row = rows[0]
  if (!row) return null
  if (now.getTime() - row.last_seen_at.getTime() < RENEW_AFTER_MS) {
    return { expiresAt: row.expires_at, renewed: false }
  }
  const expiresAt = new Date(now.getTime() + SESSION_MS)
  await db.query('update auth_sessions set last_seen_at = $2, expires_at = $3 where token_hash = $1', [
    digest(token),
    now,
    expiresAt,
  ])
  return { expiresAt, renewed: true }
}

export async function deleteSession(db: Queryable, token: string) {
  await db.query('delete from auth_sessions where token_hash = $1', [digest(token)])
}

export async function deleteAllSessions(db: Queryable) {
  await db.query('delete from auth_sessions')
}

export async function purgeExpired(db: Queryable, now = new Date()) {
  const { rowCount } = await db.query('delete from auth_sessions where expires_at <= $1', [now])
  return rowCount ?? 0
}

// Per l'elenco in Impostazioni › Account (SET-007): un id ricavato
// dall'hash, che non apre niente, e il dispositivo letto dallo user agent.
export type SessionInfo = {
  id: string
  device: string
  createdAt: string
  lastSeenAt: string
  current: boolean
}

const publicId = (tokenHash: string) =>
  createHash('sha256').update(`id:${tokenHash}`).digest('hex').slice(0, 16)

export async function listSessions(
  db: Queryable,
  currentToken?: string,
  now = new Date(),
): Promise<SessionInfo[]> {
  const { rows } = await db.query<{
    token_hash: string
    created_at: Date
    last_seen_at: Date
    user_agent: string | null
  }>(
    `select token_hash, created_at, last_seen_at, user_agent from auth_sessions
      where expires_at > $1 order by last_seen_at desc`,
    [now],
  )
  const current = currentToken ? digest(currentToken) : null
  return rows.map((r) => ({
    id: publicId(r.token_hash),
    device: deviceName(r.user_agent),
    createdAt: r.created_at.toISOString(),
    lastSeenAt: r.last_seen_at.toISOString(),
    current: r.token_hash === current,
  }))
}

// true se la sessione c'era.
export async function deleteSessionById(db: Queryable, id: string) {
  const { rows } = await db.query<{ token_hash: string }>('select token_hash from auth_sessions')
  const match = rows.find((r) => publicId(r.token_hash) === id)
  if (!match) return false
  await db.query('delete from auth_sessions where token_hash = $1', [match.token_hash])
  return true
}

export async function deleteOtherSessions(db: Queryable, currentToken: string) {
  await db.query('delete from auth_sessions where token_hash <> $1', [digest(currentToken)])
}

export function isCurrentSession(id: string, currentToken?: string) {
  return Boolean(currentToken) && publicId(digest(currentToken!)) === id
}

// "Safari su iPhone", "Chrome su Mac": abbastanza per riconoscerlo.
export function deviceName(userAgent: string | null) {
  if (!userAgent) return 'Dispositivo sconosciuto'
  const ua = userAgent
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Firefox\//.test(ua)
      ? 'Firefox'
      : /Chrome\//.test(ua)
        ? 'Chrome'
        : /Safari\//.test(ua)
          ? 'Safari'
          : null
  const os = /iPhone/.test(ua)
    ? 'iPhone'
    : /iPad/.test(ua)
      ? 'iPad'
      : /Android/.test(ua)
        ? 'Android'
        : /Mac OS X|Macintosh/.test(ua)
          ? 'Mac'
          : /Windows/.test(ua)
            ? 'Windows'
            : /Linux/.test(ua)
              ? 'Linux'
              : null
  if (browser && os) return `${browser} su ${os}`
  return browser ?? os ?? 'Dispositivo sconosciuto'
}

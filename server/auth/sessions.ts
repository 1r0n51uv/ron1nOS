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

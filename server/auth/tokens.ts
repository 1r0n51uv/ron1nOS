// Token per l'app iOS (AUTH-005): si creano dalle Impostazioni con un nome,
// si mostrano una volta sola e valgono per tutte le rotte come la sessione
// web. Il database ne tiene solo l'hash; non scadono, si revocano.
import { createHash, randomBytes } from 'node:crypto'

import type { Queryable } from '../db.ts'

// Riconoscibile se finisce in un log o negli appunti.
export const TOKEN_PREFIX = 'r1n_'
// L'ultimo uso si scrive al più una volta ogni ora, non a ogni richiesta.
const TOUCH_AFTER_MS = 60 * 60_000

const digest = (token: string) => createHash('sha256').update(token).digest('hex')

export type TokenInfo = { id: string; name: string; createdAt: string; lastUsedAt: string | null }

type Row = { id: string; name: string; created_at: Date; last_used_at: Date | null }

const info = (r: Row): TokenInfo => ({
  id: r.id,
  name: r.name,
  createdAt: r.created_at.toISOString(),
  lastUsedAt: r.last_used_at?.toISOString() ?? null,
})

export async function createToken(db: Queryable, name: string, now = new Date()) {
  const token = TOKEN_PREFIX + randomBytes(32).toString('base64url')
  const { rows } = await db.query<Row>(
    `insert into auth_tokens (id, name, token_hash, created_at) values ($1, $2, $3, $4)
     returning id, name, created_at, last_used_at`,
    [randomBytes(8).toString('hex'), name, digest(token), now],
  )
  return { token, ...info(rows[0]) }
}

// true se il token esiste; aggiorna l'ultimo uso.
export async function checkToken(db: Queryable, token: string, now = new Date()) {
  if (!token.startsWith(TOKEN_PREFIX)) return false
  const { rows } = await db.query<{ last_used_at: Date | null }>(
    'select last_used_at from auth_tokens where token_hash = $1',
    [digest(token)],
  )
  const row = rows[0]
  if (!row) return false
  if (!row.last_used_at || now.getTime() - row.last_used_at.getTime() >= TOUCH_AFTER_MS) {
    await db.query('update auth_tokens set last_used_at = $2 where token_hash = $1', [digest(token), now])
  }
  return true
}

export async function listTokens(db: Queryable): Promise<TokenInfo[]> {
  const { rows } = await db.query<Row>(
    'select id, name, created_at, last_used_at from auth_tokens order by created_at desc',
  )
  return rows.map(info)
}

// true se il token c'era.
export async function deleteToken(db: Queryable, id: string) {
  const { rowCount } = await db.query('delete from auth_tokens where id = $1', [id])
  return (rowCount ?? 0) > 0
}

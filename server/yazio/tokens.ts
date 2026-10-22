// Token di YAZIO salvati in Postgres, cifrati con YAZIO_TOKEN_KEY
// (AES-256-GCM): un dump del database da solo non basta per entrare
// nell'account (specifica Nutrizione, Credenziali).
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

import type { Queryable } from '../db.ts'

export type StoredToken = {
  accessToken: string
  refreshToken: string
  expiresAt: Date
}

export type TokenStore = {
  load(): Promise<StoredToken | null>
  save(token: StoredToken): Promise<void>
  clear(): Promise<void>
}

// La chiave può essere una frase qualsiasi: se ne ricavano 32 byte.
function keyFrom(secret: string) {
  return createHash('sha256').update(secret, 'utf8').digest()
}

export function encrypt(text: string, secret: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', keyFrom(secret), iv)
  const data = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  return ['v1', iv, cipher.getAuthTag(), data]
    .map((p) => (typeof p === 'string' ? p : p.toString('base64')))
    .join('.')
}

// Una chiave diversa o un valore manomesso danno null: si rifà il login.
export function decrypt(value: string, secret: string) {
  const [version, iv, tag, data] = value.split('.')
  if (version !== 'v1' || !iv || !tag || !data) return null
  try {
    const decipher = createDecipheriv('aes-256-gcm', keyFrom(secret), Buffer.from(iv, 'base64'))
    decipher.setAuthTag(Buffer.from(tag, 'base64'))
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8')
  } catch {
    return null
  }
}

export function dbTokenStore(db: Queryable, secret: string): TokenStore {
  return {
    async load() {
      const { rows } = await db.query<{ access: string; refresh: string; expires_at: Date }>(
        `select access_token_enc as access, refresh_token_enc as refresh, expires_at
           from yazio_tokens where id = 1`,
      )
      const row = rows[0]
      if (!row) return null
      const accessToken = decrypt(row.access, secret)
      const refreshToken = decrypt(row.refresh, secret)
      if (!accessToken || !refreshToken) return null
      return { accessToken, refreshToken, expiresAt: row.expires_at }
    },
    async save(token) {
      await db.query(
        `insert into yazio_tokens (id, access_token_enc, refresh_token_enc, expires_at, updated_at)
         values (1, $1, $2, $3, now())
         on conflict (id) do update set access_token_enc = excluded.access_token_enc,
           refresh_token_enc = excluded.refresh_token_enc, expires_at = excluded.expires_at,
           updated_at = now()`,
        [encrypt(token.accessToken, secret), encrypt(token.refreshToken, secret), token.expiresAt],
      )
    },
    async clear() {
      await db.query('delete from yazio_tokens')
    },
  }
}

export function memoryTokenStore(
  initial: StoredToken | null = null,
): TokenStore & { current: StoredToken | null } {
  const store = {
    current: initial,
    load: async () => store.current,
    save: async (t: StoredToken) => {
      store.current = t
    },
    clear: async () => {
      store.current = null
    },
  }
  return store
}

// Postgres del backend: il database `ron1nos` nel Postgres condiviso del
// server (docs/specs/nutrition.md, Architettura). Le migrazioni sono file
// SQL in server/migrations, applicati in ordine all'avvio e registrati in
// schema_migrations, così rilanciare non rifà nulla.
import { readdir, readFile } from 'node:fs/promises'

import pg from 'pg'

// I numeric arrivano come numero, non come stringa: kcal e grammi non
// superano mai la precisione di un double.
pg.types.setTypeParser(pg.types.builtins.NUMERIC, Number)
pg.types.setTypeParser(pg.types.builtins.INT8, Number)
// Le date restano `YYYY-MM-DD`, senza passare dal fuso del processo.
pg.types.setTypeParser(pg.types.builtins.DATE, (v: string) => v)

export class DatabaseUnavailableError extends Error {}

export type Queryable = Pick<pg.Pool | pg.PoolClient, 'query'>

export type Db = Queryable & {
  // Esegue fn in una transazione: commit se riesce, rollback se lancia.
  tx<T>(fn: (client: Queryable) => Promise<T>): Promise<T>
  end(): Promise<void>
}

type Options = {
  // Schema da usare al posto di public: i test ne creano uno per file.
  schema?: string
}

export function createDb(url: string, { schema }: Options = {}): Db {
  const pool = new pg.Pool({
    connectionString: url,
    max: 5,
    ...(schema ? { options: `-c search_path=${schema}` } : {}),
  })
  // Un errore su una connessione ferma nel pool non deve chiudere il processo.
  pool.on('error', (err) => console.warn(`postgres: ${err.message}`))

  const query = (async (...args: Parameters<pg.Pool['query']>) => {
    try {
      return await (pool.query as (...a: unknown[]) => Promise<unknown>)(...args)
    } catch (err) {
      throw wrap(err)
    }
  }) as pg.Pool['query']

  return {
    query,
    async tx(fn) {
      let client: pg.PoolClient
      try {
        client = await pool.connect()
      } catch (err) {
        throw wrap(err)
      }
      try {
        await client.query('begin')
        const result = await fn(client)
        await client.query('commit')
        return result
      } catch (err) {
        await client.query('rollback').catch(() => {})
        throw wrap(err)
      } finally {
        client.release()
      }
    },
    end: () => pool.end(),
  }
}

// Connessione rifiutata, host sconosciuto, credenziali errate, database
// inesistente: il modulo risponde 503, il resto della dashboard continua.
function wrap(err: unknown) {
  if (err instanceof DatabaseUnavailableError) return err
  const code = (err as { code?: string }).code ?? ''
  if (/^(ECONNREFUSED|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|ECONNRESET)$/.test(code) || /^(08|28|3D)/.test(code)) {
    return new DatabaseUnavailableError((err as Error).message)
  }
  return err
}

const MIGRATIONS_DIR = new URL('./migrations/', import.meta.url)

export async function migrate(db: Db, dir: URL = MIGRATIONS_DIR) {
  const files = (await readdir(dir)).filter((f) => /^\d{4}_.+\.sql$/.test(f)).sort()
  return db.tx(async (client) => {
    // Un solo processo alla volta applica le migrazioni.
    await client.query('select pg_advisory_xact_lock(7210001)')
    await client.query(
      `create table if not exists schema_migrations (
         name text primary key,
         applied_at timestamptz not null default now()
       )`,
    )
    const { rows } = await client.query<{ name: string }>('select name from schema_migrations')
    const done = new Set(rows.map((r) => r.name))
    const applied: string[] = []
    for (const file of files) {
      if (done.has(file)) continue
      await client.query(await readFile(new URL(file, dir), 'utf8'))
      await client.query('insert into schema_migrations (name) values ($1)', [file])
      applied.push(file)
    }
    return applied
  })
}

export type DbStatus = 'disabled' | 'starting' | 'ok' | 'unavailable'

export type Database = {
  db?: Db
  status(): DbStatus
}

// All'avvio applica le migrazioni; se Postgres non risponde riprova con
// attesa crescente (fino a un minuto) senza fermare il resto del backend.
export function startDatabase(
  db: Db | undefined,
  { retryMs = 2_000, maxRetryMs = 60_000, log = console.warn } = {},
): Database & { ready: Promise<void> } {
  let status: DbStatus = db ? 'starting' : 'disabled'
  const ready = (async () => {
    if (!db) return
    for (let wait = retryMs; ; wait = Math.min(wait * 2, maxRetryMs)) {
      try {
        const applied = await migrate(db)
        if (applied.length) log(`migrazioni applicate: ${applied.join(', ')}`)
        status = 'ok'
        return
      } catch (err) {
        status = 'unavailable'
        log(`database non pronto (${(err as Error).message}), nuovo tentativo fra ${wait / 1000} s`)
        await new Promise((r) => setTimeout(r, wait).unref())
      }
    }
  })()
  return { db, status: () => status, ready }
}

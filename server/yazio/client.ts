// Adattatore dell'API non ufficiale di YAZIO: l'unico punto del backend che
// ci parla, così quando YAZIO cambia si ripara qui (specifica Nutrizione,
// Analisi integrazione YAZIO). Login con password grant, token rinnovato
// prima della scadenza, risposte validate, errori distinti con nuovi
// tentativi a intervalli crescenti su 429, 5xx e rete.
import type { z } from 'zod'

import type {
  ConsumedItems,
  DailySummary,
  Daytime,
  Exercises,
  Goals,
  Product,
  ProductSearchResult,
  Weight,
} from './schemas.ts'
import {
  ConsumedItemsSchema,
  DailySummarySchema,
  ExercisesSchema,
  GoalsSchema,
  ProductSchema,
  ProductSearchResultSchema,
  TokenSchema,
  WaterSchema,
  WeightSchema,
} from './schemas.ts'
import type { StoredToken, TokenStore } from './tokens.ts'

export class YazioError extends Error {}
// Credenziali rifiutate: password cambiata o chiavi dell'app ruotate.
export class YazioAuthError extends YazioError {}
export class YazioRateLimitError extends YazioError {}
export class YazioServerError extends YazioError {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}
export class YazioUnreachableError extends YazioError {}
// La risposta non ha la forma attesa: l'API è cambiata.
export class YazioFormatError extends YazioError {
  readonly code = 'yazio_format_changed'
}
// Una richiesta rifiutata per un motivo nostro (400, 404…).
export class YazioRequestError extends YazioError {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export type YazioConfig = {
  url: string // con la versione, es. https://yzapi.yazio.com/v20
  clientId: string
  clientSecret: string
  username: string
  password: string
}

type Options = YazioConfig & {
  tokens: TokenStore
  fetch?: typeof fetch
  sleep?: (ms: number) => Promise<void>
  now?: () => number
  // Tentativi su 429, 5xx e rete, con attesa che raddoppia.
  retries?: number
  retryBaseMs?: number
  timeoutMs?: number
}

export type NewConsumedProduct = {
  id: string
  productId: string
  date: string // YYYY-MM-DD
  daytime: Daytime
  amount: number // in unità di base (g o ml)
  serving?: string | null
  servingQuantity?: number | null
}

export type SearchOptions = { countries?: string[]; locales?: string[] }

export type YazioClient = ReturnType<typeof createYazioClient>

// Il token si rinnova se scade entro 10 minuti (dura 48 ore).
const REFRESH_MARGIN_MS = 10 * 60_000

export function createYazioClient(opts: Options) {
  const {
    tokens,
    fetch: doFetch = fetch,
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
    now = Date.now,
    retries = 3,
    retryBaseMs = 1_000,
    timeoutMs = 15_000,
  } = opts
  const base = opts.url.replace(/\/+$/, '')
  let pending: Promise<StoredToken> | null = null

  async function raw(path: string, init: RequestInit) {
    for (let attempt = 0; ; attempt++) {
      let res: Response | null = null
      let error: YazioError
      try {
        res = await doFetch(`${base}${path}`, { ...init, signal: AbortSignal.timeout(timeoutMs) })
        if (res.status === 429) error = new YazioRateLimitError('YAZIO: troppe richieste')
        else if (res.status >= 500) error = new YazioServerError(`YAZIO: errore ${res.status}`, res.status)
        else return res
      } catch {
        error = new YazioUnreachableError('YAZIO non raggiungibile')
      }
      if (attempt >= retries) throw error
      const retryAfter = Number(res?.headers.get('retry-after'))
      await sleep(retryAfter > 0 ? retryAfter * 1000 : retryBaseMs * 2 ** attempt)
    }
  }

  async function tokenRequest(grant: Record<string, string>): Promise<StoredToken> {
    const res = await raw('/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: opts.clientId, client_secret: opts.clientSecret, ...grant }),
    })
    if (res.status === 400 || res.status === 401)
      throw new YazioAuthError('YAZIO ha rifiutato le credenziali')
    if (!res.ok) throw new YazioRequestError(`YAZIO: login ${res.status}`, res.status)
    const t = parse(TokenSchema, await body(res), 'oauth/token')
    const token = {
      accessToken: t.access_token,
      refreshToken: t.refresh_token,
      expiresAt: new Date(now() + t.expires_in * 1000),
    }
    await tokens.save(token)
    return token
  }

  const login = () =>
    tokenRequest({ grant_type: 'password', username: opts.username, password: opts.password })

  // Il refresh prima, la password solo se il refresh non va.
  async function renew(current: StoredToken | null) {
    if (current) {
      try {
        return await tokenRequest({ grant_type: 'refresh_token', refresh_token: current.refreshToken })
      } catch (err) {
        if (!(err instanceof YazioAuthError)) throw err
      }
    }
    return login()
  }

  // Una sola richiesta di token alla volta, anche con chiamate in parallelo.
  function once(fn: () => Promise<StoredToken>) {
    pending ??= fn().finally(() => {
      pending = null
    })
    return pending
  }

  async function token(force = false) {
    if (pending) return pending
    const current = await tokens.load()
    if (!force && current && current.expiresAt.getTime() - now() > REFRESH_MARGIN_MS) return current
    return once(() => renew(current))
  }

  async function call(method: string, path: string, payload?: unknown): Promise<Response> {
    const send = async (t: StoredToken) =>
      raw(path, {
        method,
        headers: {
          Authorization: `Bearer ${t.accessToken}`,
          Accept: 'application/json',
          ...(payload === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: payload === undefined ? undefined : JSON.stringify(payload),
      })
    let res = await send(await token())
    // Token revocato prima della scadenza: si rinnova una volta e si riprova.
    if (res.status === 401) {
      res = await send(await token(true))
      if (res.status === 401) throw new YazioAuthError('YAZIO ha rifiutato il token')
    }
    if (!res.ok)
      throw new YazioRequestError(`YAZIO: ${method} ${path.split('?')[0]} ${res.status}`, res.status)
    return res
  }

  async function get<S extends z.ZodType>(schema: S, path: string): Promise<z.output<S>> {
    return parse(schema, await body(await call('GET', path)), path.split('?')[0])
  }

  const q = (params: Record<string, string>) => new URLSearchParams(params).toString()

  return {
    // Login esplicito (collegamento, NUT-020): verifica le credenziali.
    login,

    consumedItems: (date: string): Promise<ConsumedItems> =>
      get(ConsumedItemsSchema, `/user/consumed-items?${q({ date })}`),

    // L'id lo sceglie chi scrive: ron1nOS usa l'id della sua riga.
    async addConsumedProducts(items: NewConsumedProduct[]) {
      await call('POST', '/user/consumed-items', {
        products: items.map((i) => ({
          id: i.id,
          product_id: i.productId,
          date: `${i.date} 12:00:00`,
          daytime: i.daytime,
          amount: i.amount,
          serving: i.serving ?? null,
          serving_quantity: i.servingQuantity ?? null,
        })),
        recipe_portions: [],
        simple_products: [],
      })
    },

    async deleteConsumedItems(ids: string[]) {
      if (ids.length) await call('DELETE', '/user/consumed-items', ids)
    },

    // Obiettivo del giorno con l'energia attiva già sommata (NUT-016).
    dailySummary: (date: string): Promise<DailySummary> =>
      get(DailySummarySchema, `/user/widgets/daily-summary?${q({ date })}`),

    // Obiettivo di base, senza esercizi (NUT-015).
    goals: (date: string): Promise<Goals> => get(GoalsSchema, `/user/goals/unmodified?${q({ date })}`),

    exercises: (date: string): Promise<Exercises> => get(ExercisesSchema, `/user/exercises?${q({ date })}`),

    async water(date: string) {
      return (await get(WaterSchema, `/user/water-intake?${q({ date })}`)).water_intake
    },

    // Si scrive il totale del giorno, non l'aggiunta.
    async setWater(date: string, totalMl: number) {
      await call('POST', '/user/water-intake', [{ date: `${date} 12:00:00`, water_intake: totalMl }])
    },

    async lastWeight(date: string): Promise<Weight | null> {
      const data = await body(await call('GET', `/user/bodyvalues/weight/last?${q({ date })}`))
      return data == null || (typeof data === 'object' && !Object.keys(data).length)
        ? null
        : parse(WeightSchema, data, '/user/bodyvalues/weight/last')
    },

    // Storico non documentato ma provato: [{ date, value }].
    async weightHistory(start: string, end: string): Promise<Weight[]> {
      const list = await get(WeightSchema.array(), `/user/bodyvalues/weight?${q({ start, end })}`)
      return list.filter((w) => w.value !== null)
    },

    // Anche per EAN: /products/barcode non esiste (prova del 2026-10-21).
    searchProducts: (
      query: string,
      { countries = ['IT'], locales = ['it_IT'] }: SearchOptions = {},
    ): Promise<ProductSearchResult[]> =>
      get(
        ProductSearchResultSchema.array(),
        `/products/search?${q({ query, sex: 'male', countries: countries.join(','), locales: locales.join(',') })}`,
      ),

    async product(id: string): Promise<Product | null> {
      try {
        return { ...(await get(ProductSchema, `/products/${encodeURIComponent(id)}`)), id }
      } catch (err) {
        if (err instanceof YazioRequestError && err.status === 404) return null
        throw err
      }
    },
  }
}

async function body(res: Response): Promise<unknown> {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    throw new YazioFormatError('YAZIO: risposta non JSON')
  }
}

function parse<S extends z.ZodType>(schema: S, data: unknown, what: string): z.output<S> {
  const result = schema.safeParse(data)
  if (!result.success) {
    const where = result.error.issues[0]?.path.join('.') || 'radice'
    throw new YazioFormatError(`YAZIO: formato cambiato in ${what} (${where})`)
  }
  return result.data
}

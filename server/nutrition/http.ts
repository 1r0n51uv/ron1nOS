// Errori e validazione comuni alle rotte del modulo Nutrizione. Le rotte
// ricevono l'intenzione del client (aggiungi, segna mangiato) e la regola
// la applica il server: qui si controlla solo la forma della richiesta.
import type { Context } from 'hono'
import type { z } from 'zod'

// 400 invalid_request: il messaggio è in italiano e si può mostrare.
export class InvalidRequestError extends Error {}
// 404 not_found.
export class NotFoundError extends Error {}
// 503 yazio_unreachable: YAZIO non risponde a una richiesta fatta a mano.
export class YazioUnavailableError extends Error {}
// 409: la richiesta è valida ma lo stato non la permette (es. obiettivo da YAZIO).
export class ConflictError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

export async function readJson<S extends z.ZodType>(c: Context, schema: S): Promise<z.output<S>> {
  const raw = await c.req.json().catch(() => {
    throw new InvalidRequestError('Corpo della richiesta non valido')
  })
  return check(schema, raw)
}

export function check<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const result = schema.safeParse(value)
  if (!result.success) {
    const issue = result.error.issues[0]
    const where = issue?.path.join('.')
    throw new InvalidRequestError(where ? `Campo non valido: ${where}` : 'Richiesta non valida')
  }
  return result.data
}

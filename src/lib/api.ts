// Chiamate al backend di ron1nOS (/api/v1). Gli errori arrivano come JSON
// { error, message }: qui diventano ApiError, che i widget leggono per
// mostrare lo stato giusto (servizio spento, accesso rifiutato…).
export class ApiError extends Error {
  readonly code: string
  readonly status: number
  // Il corpo dell'errore, per i campi in più (es. il torrent duplicato).
  readonly body: Record<string, unknown>

  constructor(code: string, message: string, status: number, body: Record<string, unknown> = {}) {
    super(message)
    this.code = code
    this.status = status
    this.body = body
  }
}

async function parse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T
  if (res.ok) return (await res.json()) as T
  const body = (await res.json().catch(() => null)) as
    ({ error?: string; message?: string } & Record<string, unknown>) | null
  throw new ApiError(
    body?.error ?? 'http_error',
    body?.message ?? `HTTP ${res.status}`,
    res.status,
    body ?? {},
  )
}

async function send<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api/v1${path}`, init)
  } catch {
    throw new ApiError('network', 'Backend non raggiungibile', 0)
  }
  return parse<T>(res)
}

export const api = {
  get: <T>(path: string) => send<T>(path),
  post: <T>(path: string, body?: unknown) =>
    send<T>(path, {
      method: 'POST',
      ...(body instanceof FormData
        ? { body }
        : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) }),
    }),
  patch: <T>(path: string, body: unknown) =>
    send<T>(path, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  put: <T>(path: string, body: unknown) =>
    send<T>(path, {
      method: 'PUT',
      ...(body instanceof FormData
        ? { body }
        : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    }),
  delete: <T>(path: string) => send<T>(path, { method: 'DELETE' }),
}

// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createApp } from '../app.ts'
import { fakeQbt } from '../testing/fake-qbt.ts'
import { testDb } from '../testing/db.ts'
import { hashPassword } from './password.ts'
import { SESSION_COOKIE } from './routes.ts'
import { createSession, touchSession } from './sessions.ts'

const PASSWORD = 'una password abbastanza lunga'

let db: Awaited<ReturnType<typeof testDb>>
let passwordHash: string
beforeAll(async () => {
  db = await testDb()
  passwordHash = await hashPassword(PASSWORD)
})
afterAll(() => db.drop())
beforeEach(() => db.query('delete from auth_sessions'))

const app = () =>
  createApp({
    qbt: fakeQbt(),
    database: { db, status: () => 'ok' },
    auth: { passwordHash },
  })

function login(a: ReturnType<typeof app>, password = PASSWORD, ip = '10.0.0.1') {
  return a.request('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify({ password }),
  })
}

const cookieOf = (res: Response) => res.headers.get('set-cookie')?.split(';')[0] ?? ''

describe('login (AUTH-002, AUTH-003)', () => {
  it('senza sessione le rotte rispondono 401, health no', async () => {
    const a = app()
    expect((await a.request('/api/v1/health')).status).toBe(200)
    const res = await a.request('/api/v1/downloads')
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'unauthenticated', message: 'Accesso richiesto' })
    expect((await a.request('/api/v1/nutrition/day')).status).toBe(401)
    expect((await a.request('/api/v1/auth/me')).status).toBe(401)
  })

  it('password giusta: cookie HttpOnly, Secure, SameSite=Strict, poi le rotte rispondono', async () => {
    const a = app()
    const res = await login(a)
    expect(res.status).toBe(200)
    const header = res.headers.get('set-cookie') ?? ''
    expect(header).toMatch(new RegExp(`^${SESSION_COOKIE}=`))
    expect(header).toMatch(/HttpOnly/)
    expect(header).toMatch(/Secure/)
    expect(header).toMatch(/SameSite=Strict/)
    const me = await a.request('/api/v1/auth/me', { headers: { cookie: cookieOf(res) } })
    expect(await me.json()).toEqual({ enabled: true })
    expect((await a.request('/api/v1/downloads', { headers: { cookie: cookieOf(res) } })).status).toBe(200)
  })

  it('nel database c’è solo l’hash del token', async () => {
    const res = await login(app())
    const token = cookieOf(res).split('=')[1]
    const { rows } = await db.query<{ token_hash: string }>('select token_hash from auth_sessions')
    expect(rows).toHaveLength(1)
    expect(rows[0].token_hash).not.toContain(token)
  })

  it('password sbagliata: 401 invalid_password, nessun cookie', async () => {
    const res = await login(app(), 'sbagliata')
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'invalid_password', message: 'Password non valida' })
    expect(res.headers.get('set-cookie')).toBeNull()
  })

  it('un cookie inventato non apre nulla', async () => {
    const res = await app().request('/api/v1/downloads', {
      headers: { cookie: `${SESSION_COOKIE}=inventato` },
    })
    expect(res.status).toBe(401)
  })

  it('logout chiude la sessione', async () => {
    const a = app()
    const cookie = cookieOf(await login(a))
    expect((await a.request('/api/v1/auth/logout', { method: 'POST', headers: { cookie } })).status).toBe(204)
    expect((await a.request('/api/v1/downloads', { headers: { cookie } })).status).toBe(401)
  })

  it('Esci ovunque chiude tutte le sessioni', async () => {
    const a = app()
    const one = cookieOf(await login(a))
    const two = cookieOf(await login(a))
    const res = await a.request('/api/v1/auth/sessions', { method: 'DELETE', headers: { cookie: one } })
    expect(res.status).toBe(204)
    expect((await a.request('/api/v1/downloads', { headers: { cookie: two } })).status).toBe(401)
  })

  it('una richiesta che cambia dati da un’altra origine è rifiutata', async () => {
    const a = app()
    const cookie = cookieOf(await login(a))
    const headers = { cookie, host: 'ron1n.home', 'content-type': 'application/json' }
    const evil = await a.request('/api/v1/nutrition/water', {
      method: 'POST',
      headers: { ...headers, origin: 'https://evil.example' },
      body: '{}',
    })
    expect(evil.status).toBe(403)
    expect(await evil.json()).toMatchObject({ error: 'forbidden_origin' })
    const same = await a.request('/api/v1/auth/logout', {
      method: 'POST',
      headers: { ...headers, origin: 'https://ron1n.home' },
    })
    expect(same.status).toBe(204)
  })

  it('senza database il login risponde 503', async () => {
    const a = createApp({ qbt: fakeQbt(), database: { status: () => 'unavailable' }, auth: { passwordHash } })
    expect((await login(a)).status).toBe(503)
  })
})

describe('login spento (senza AUTH_PASSWORD_HASH)', () => {
  it('l’API resta aperta e /auth/me lo dice', async () => {
    const a = createApp({ qbt: fakeQbt() })
    expect((await a.request('/api/v1/downloads')).status).toBe(200)
    expect(await (await a.request('/api/v1/auth/me')).json()).toEqual({ enabled: false })
    expect((await login(a)).status).toBe(409)
  })
})

describe('limite ai tentativi (AUTH-004)', () => {
  it('al sesto tentativo sbagliato risponde 429 anche con la password giusta', async () => {
    const a = app()
    for (let i = 0; i < 5; i++) expect((await login(a, 'sbagliata', '10.9.9.9')).status).toBe(401)
    const blocked = await login(a, PASSWORD, '10.9.9.9')
    expect(blocked.status).toBe(429)
    expect(await blocked.json()).toEqual({
      error: 'too_many_attempts',
      message: 'Troppi tentativi. Riprova tra 15 minuti.',
    })
    expect(blocked.headers.get('retry-after')).toBe('900')
    expect((await login(a, PASSWORD, '10.0.0.2')).status).toBe(200)
  })
})

describe('sessioni (AUTH-002)', () => {
  it('durano 30 giorni e si rinnovano con l’uso', async () => {
    const t0 = new Date('2026-10-01T10:00:00Z')
    const { token, expiresAt } = await createSession(db, 'test', t0)
    expect(expiresAt.toISOString()).toBe('2026-10-31T10:00:00.000Z')
    // Entro un'ora non riscrive.
    expect(await touchSession(db, token, new Date('2026-10-01T10:30:00Z'))).toMatchObject({ renewed: false })
    const later = await touchSession(db, token, new Date('2026-10-20T10:00:00Z'))
    expect(later).toEqual({ renewed: true, expiresAt: new Date('2026-11-19T10:00:00Z') })
    expect(await touchSession(db, token, new Date('2026-11-19T10:00:01Z'))).toBeNull()
  })
})

describe('sessioni in Impostazioni › Account (SET-007)', () => {
  const IPHONE =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'

  async function twoSessions(a: ReturnType<typeof app>) {
    const mine = cookieOf(await login(a))
    await createSession(db, IPHONE)
    return mine
  }
  const list = async (a: ReturnType<typeof app>, cookie: string) =>
    (
      (await (await a.request('/api/v1/auth/sessions', { headers: { cookie } })).json()) as {
        sessions: { id: string; device: string; current: boolean }[]
      }
    ).sessions

  it('elenca le sessioni con dispositivo e quella attuale segnata, senza token', async () => {
    const a = app()
    const mine = await twoSessions(a)
    const res = await a.request('/api/v1/auth/sessions', { headers: { cookie: mine } })
    const text = await res.text()
    expect(text).not.toContain(mine.split('=')[1])
    const sessions = (JSON.parse(text) as { sessions: { device: string; current: boolean }[] }).sessions
    expect(sessions).toHaveLength(2)
    expect(sessions.filter((s) => s.current)).toHaveLength(1)
    expect(sessions.map((s) => s.device)).toContain('Safari su iPhone')
  })

  it('Chiudi chiude una sessione, Chiudi le altre lascia solo questa', async () => {
    const a = app()
    const mine = await twoSessions(a)
    await createSession(db, 'curl/8.0')
    const [first] = (await list(a, mine)).filter((s) => !s.current)
    const closed = await a.request(`/api/v1/auth/sessions/${first.id}`, {
      method: 'DELETE',
      headers: { cookie: mine },
    })
    expect(closed.status).toBe(204)
    expect(await list(a, mine)).toHaveLength(2)
    await a.request('/api/v1/auth/sessions/others', { method: 'DELETE', headers: { cookie: mine } })
    const left = await list(a, mine)
    expect(left).toHaveLength(1)
    expect(left[0].current).toBe(true)
    const missing = await a.request('/api/v1/auth/sessions/0000', {
      method: 'DELETE',
      headers: { cookie: mine },
    })
    expect(missing.status).toBe(404)
  })

  it('chiudere la sessione attuale toglie anche il cookie', async () => {
    const a = app()
    const mine = await twoSessions(a)
    const current = (await list(a, mine)).find((s) => s.current)!
    const res = await a.request(`/api/v1/auth/sessions/${current.id}`, {
      method: 'DELETE',
      headers: { cookie: mine },
    })
    expect(res.headers.get('set-cookie')).toContain(`${SESSION_COOKIE}=;`)
    expect((await a.request('/api/v1/auth/me', { headers: { cookie: mine } })).status).toBe(401)
  })
})

// YAZIO finto: le rotte dell'API che l'adattatore usa, con uno stato in
// memoria. Lo usano i test unit (fetch in processo) e gli e2e
// (e2e/fake-yazio.ts lo serve su una porta). Le rotte /__fake/* cambiano lo
// stato dai test: credenziali, guasti, prodotti, diario.
import { Hono } from 'hono'

export const FAKE_CLIENT = { id: 'client-finto', secret: 'segreto-finto' }
export const FAKE_USER = { username: 'mario@example.com', password: 'password-finta' }

type ConsumedProduct = {
  id: string
  date: string
  daytime: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  product_id: string
  amount: number
  serving: string | null
  serving_quantity: number | null
}

export type FakeProduct = {
  id: string
  name: string
  producer?: string
  eans?: string[]
  // kcal e grammi di macro per 100 g.
  kcal: number
  protein: number
  carbs: number
  fat: number
  countries?: string[]
}

export type FakeYazioState = {
  online: boolean
  password: string
  // Risposte forzate: le prossime N richieste API rispondono con questo stato.
  failNext: { status: number; count: number } | null
  // Rompe il formato del diario (campo daytime mancante).
  brokenFormat: boolean
  // Versione dell'API bloccata: /user/* risponde 403 version_blocked.
  versionBlocked: boolean
  consumed: ConsumedProduct[]
  water: Record<string, number>
  goals: { kcal: number; protein: number; carbs: number; fat: number; water: number }
  activity: Record<string, number>
  consumeActivity: boolean
  weights: { date: string; value: number }[]
  products: FakeProduct[]
  tokens: Record<string, { refresh: string; expiresAt: number }>
  calls: { method: string; path: string }[]
}

export const FAKE_PRODUCTS: FakeProduct[] = [
  { id: 'p-mela', name: 'Mela', kcal: 52, protein: 0.3, carbs: 14, fat: 0.2, countries: ['IT'] },
  {
    id: 'p-yogurt',
    name: 'Yogurt greco bianco 2%',
    producer: 'Fage',
    eans: ['5201054017111'],
    kcal: 73,
    protein: 10,
    carbs: 3.9,
    fat: 2,
    countries: ['IT'],
  },
  {
    id: 'p-grissini',
    name: 'Grissini classici',
    producer: 'Mulino Bianco',
    eans: ['8076809513753'],
    kcal: 412,
    protein: 12,
    carbs: 70,
    fat: 8.5,
    countries: ['IT'],
  },
  { id: 'p-banane', name: 'Banane', kcal: 89, protein: 1.1, carbs: 23, fat: 0.3, countries: ['DE'] },
]

export function initialFakeYazioState(): FakeYazioState {
  return {
    online: true,
    password: FAKE_USER.password,
    failNext: null,
    brokenFormat: false,
    versionBlocked: false,
    consumed: [],
    water: {},
    goals: { kcal: 2021, protein: 126, carbs: 227, fat: 67, water: 2500 },
    activity: {},
    consumeActivity: true,
    weights: [],
    products: FAKE_PRODUCTS.map((p) => ({ ...p })),
    tokens: {},
    calls: [],
  }
}

const per1g = (p: FakeProduct) => ({
  'energy.energy': p.kcal / 100,
  'nutrient.protein': p.protein / 100,
  'nutrient.carb': p.carbs / 100,
  'nutrient.fat': p.fat / 100,
})

export function createFakeYazio(state: FakeYazioState = initialFakeYazioState()) {
  let seq = 0
  const app = new Hono()

  app.get('/__fake/health', (c) => c.json({ ok: true }))
  app.get('/__fake/state', (c) => c.json(state))
  app.post('/__fake/state', async (c) => {
    Object.assign(state, await c.req.json())
    return c.json({ ok: true })
  })
  app.post('/__fake/reset', (c) => {
    Object.assign(state, initialFakeYazioState())
    return c.json({ ok: true })
  })

  const api = new Hono()

  api.use('*', async (c, next) => {
    state.calls.push({ method: c.req.method, path: new URL(c.req.url).pathname })
    if (!state.online) return c.json({ error: 'offline' }, 503)
    if (state.failNext && state.failNext.count > 0) {
      state.failNext.count--
      return c.json({ error: 'forzato' }, state.failNext.status as 500)
    }
    if (state.versionBlocked && new URL(c.req.url).pathname.includes('/user/'))
      return c.json({ error: 'version_blocked' }, 403)
    await next()
  })

  api.post('/oauth/token', async (c) => {
    const form = await c.req.parseBody()
    if (form.client_id !== FAKE_CLIENT.id || form.client_secret !== FAKE_CLIENT.secret) {
      return c.json({ error: 'invalid_client' }, 400)
    }
    let ok = false
    if (form.grant_type === 'password') {
      ok = form.username === FAKE_USER.username && form.password === state.password
    } else if (form.grant_type === 'refresh_token') {
      ok = Object.values(state.tokens).some((t) => t.refresh === form.refresh_token)
    }
    if (!ok) return c.json({ error: 'invalid_grant' }, 400)
    seq++
    const access = `access-${seq}`
    state.tokens = { [access]: { refresh: `refresh-${seq}`, expiresAt: Date.now() + 172_800_000 } }
    return c.json({
      token_type: 'bearer',
      access_token: access,
      refresh_token: `refresh-${seq}`,
      expires_in: 172800,
    })
  })

  api.use('/user/*', async (c, next) => {
    const auth = c.req.header('authorization')?.replace(/^Bearer /, '') ?? ''
    if (!state.tokens[auth]) return c.json({ error: 'unauthorized' }, 401)
    await next()
  })
  api.use('/products/*', async (c, next) => {
    const auth = c.req.header('authorization')?.replace(/^Bearer /, '') ?? ''
    if (!state.tokens[auth]) return c.json({ error: 'unauthorized' }, 401)
    await next()
  })

  api.get('/user/consumed-items', (c) => {
    const date = c.req.query('date') ?? ''
    const products = state.consumed
      .filter((p) => p.date.startsWith(date))
      .map((p) => (state.brokenFormat ? { ...p, daytime: undefined } : p))
    return c.json({ products, recipe_portions: [], simple_products: [] })
  })
  api.post('/user/consumed-items', async (c) => {
    const body = await c.req.json<{ products: ConsumedProduct[] }>()
    for (const p of body.products) {
      if (!state.products.some((x) => x.id === p.product_id)) return c.json({ error: 'product' }, 400)
      state.consumed = state.consumed.filter((x) => x.id !== p.id)
      state.consumed.push(p)
    }
    return c.body(null, 204)
  })
  api.delete('/user/consumed-items', async (c) => {
    const ids = await c.req.json<string[]>()
    state.consumed = state.consumed.filter((x) => !ids.includes(x.id))
    return c.body(null, 204)
  })

  const goals = () => ({
    'energy.energy': state.goals.kcal,
    'nutrient.protein': state.goals.protein,
    'nutrient.carb': state.goals.carbs,
    'nutrient.fat': state.goals.fat,
    water: state.goals.water,
    'activity.step': 10000,
    'bodyvalue.weight': 78,
  })
  api.get('/user/goals/unmodified', (c) => c.json(goals()))
  api.get('/user/widgets/daily-summary', (c) => {
    const date = c.req.query('date') ?? ''
    const activity = state.activity[date] ?? 0
    const g = goals()
    return c.json({
      activity_energy: activity,
      consume_activity_energy: state.consumeActivity,
      steps: 0,
      water_intake: state.water[date] ?? 0,
      goals: { ...g, 'energy.energy': g['energy.energy'] + (state.consumeActivity ? activity : 0) },
      units: { unit_mass: 'kg', unit_energy: 'kcal', unit_serving: 'g', unit_length: 'cm' },
    })
  })
  api.get('/user/exercises', (c) => {
    const date = c.req.query('date') ?? ''
    const kcal = state.activity[date]
    return c.json({
      training: kcal ? [{ id: `ex-${date}`, date: `${date} 18:00:00`, name: 'Corsa', energy: kcal }] : [],
      custom_training: [],
    })
  })
  api.get('/user/water-intake', (c) => c.json({ water_intake: state.water[c.req.query('date') ?? ''] ?? 0 }))
  api.post('/user/water-intake', async (c) => {
    for (const w of await c.req.json<{ date: string; water_intake: number }[]>()) {
      state.water[w.date.slice(0, 10)] = w.water_intake
    }
    return c.body(null, 204)
  })
  api.get('/user/bodyvalues/weight/last', (c) => {
    const date = c.req.query('date')
    if (!date) return c.json({ error: 'date' }, 400)
    const last = state.weights.filter((w) => w.date.slice(0, 10) <= date).at(-1)
    return last ? c.json({ id: `w-${last.date}`, ...last }) : c.body(null, 204)
  })
  api.get('/user/bodyvalues/weight', (c) => {
    const start = c.req.query('start') ?? ''
    const end = c.req.query('end') ?? '9999'
    return c.json(state.weights.filter((w) => w.date.slice(0, 10) >= start && w.date.slice(0, 10) <= end))
  })

  api.get('/products/search', (c) => {
    const query = (c.req.query('query') ?? '').toLowerCase()
    const countries = (c.req.query('countries') ?? '').split(',')
    const list = state.products.filter(
      (p) =>
        p.eans?.includes(query) ||
        (p.name.toLowerCase().includes(query) && (p.countries ?? []).some((x) => countries.includes(x))),
    )
    return c.json(
      list.map((p) => ({
        score: 1,
        name: p.name,
        product_id: p.id,
        serving: 'portion',
        serving_quantity: 1,
        amount: 100,
        base_unit: 'g',
        producer: p.producer ?? null,
        is_verified: true,
        nutrients: per1g(p),
        countries: p.countries ?? [],
        language: 'it',
      })),
    )
  })
  api.get('/products/:id', (c) => {
    const p = state.products.find((x) => x.id === c.req.param('id'))
    if (!p) return c.json({ error: 'not_found' }, 404)
    return c.json({
      name: p.name,
      producer: p.producer ?? null,
      is_verified: true,
      base_unit: 'g',
      nutrients: per1g(p),
      servings: [],
      eans: p.eans ?? [],
      countries: p.countries ?? [],
      language: 'it',
    })
  })

  app.route('/v20', api)

  return {
    app,
    state,
    fetch: (input: string | URL | Request, init?: RequestInit) => app.request(input, init),
  }
}

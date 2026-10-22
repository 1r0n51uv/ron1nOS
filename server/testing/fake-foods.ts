// OpenFoodFacts e USDA finti, per i test unit (fetch in processo) e gli
// e2e (e2e/fake-foods.ts). /off e /off-it sono la ricerca mondiale e quella
// italiana, /usda FoodData Central. /__fake/state spegne una fonte.
import { Hono } from 'hono'

type OffProduct = {
  code: string
  product_name: string
  brands?: string
  countries: ('it' | 'world')[]
  nutriments: Record<string, number>
  serving_quantity?: number
}

export const OFF_PRODUCTS: OffProduct[] = [
  {
    code: '5201054017111',
    product_name: 'Yogurt greco bianco 2%',
    brands: 'Fage',
    countries: ['it', 'world'],
    nutriments: { 'energy-kcal_100g': 73, proteins_100g: 10, carbohydrates_100g: 3.9, fat_100g: 2 },
    serving_quantity: 170,
  },
  {
    code: '5201153625651',
    product_name: 'Yogurt greco colato 5%',
    brands: 'Kri Kri',
    countries: ['it', 'world'],
    nutriments: { 'energy-kcal_100g': 92, proteins_100g: 8.5, carbohydrates_100g: 3.5, fat_100g: 5 },
  },
  {
    code: '8076809513753',
    product_name: 'Grissini torinesi',
    brands: 'Mulino Bianco',
    countries: ['it', 'world'],
    nutriments: { energy_100g: 1715, proteins_100g: 12, carbohydrates_100g: 70, fat_100g: 8.5 },
  },
  {
    code: '8000070012345',
    product_name: 'Caffè espresso',
    brands: 'Lavazza',
    countries: ['it', 'world'],
    nutriments: {
      'energy-kcal_100g': 2,
      proteins_100g: 0.1,
      carbohydrates_100g: 0,
      fat_100g: 0,
      caffeine_100g: 0.2,
    },
  },
  {
    code: '4001234567890',
    product_name: 'Griechischer Joghurt',
    brands: 'Milbona',
    countries: ['world'],
    nutriments: { 'energy-kcal_100g': 115, proteins_100g: 4, carbohydrates_100g: 4, fat_100g: 9.5 },
  },
  // Senza kcal: va scartato.
  { code: '0000000000001', product_name: 'Yogurt senza valori', countries: ['it', 'world'], nutriments: {} },
]

export const USDA_FOODS = [
  {
    fdcId: 171304,
    description: 'YOGURT, GREEK, PLAIN, NONFAT',
    foodNutrients: [
      { nutrientName: 'Energy', unitName: 'KCAL', value: 59 },
      { nutrientName: 'Protein', unitName: 'G', value: 10.2 },
      { nutrientName: 'Carbohydrate, by difference', unitName: 'G', value: 3.6 },
      { nutrientName: 'Total lipid (fat)', unitName: 'G', value: 0.4 },
    ],
  },
  {
    fdcId: 171688,
    description: 'Apples, raw, with skin',
    foodNutrients: [
      { nutrientName: 'Energy', unitName: 'KJ', value: 218 },
      { nutrientName: 'Energy', unitName: 'KCAL', value: 52 },
      { nutrientName: 'Protein', unitName: 'G', value: 0.3 },
      { nutrientName: 'Carbohydrate, by difference', unitName: 'G', value: 13.8 },
      { nutrientName: 'Total lipid (fat)', unitName: 'G', value: 0.2 },
    ],
  },
]

export type FakeFoodsState = { off: boolean; usda: boolean; calls: string[] }

export function createFakeFoods(state: FakeFoodsState = { off: true, usda: true, calls: [] }) {
  const app = new Hono()
  const matches = (text: string, q: string) =>
    q
      .toLowerCase()
      .split(/\s+/)
      .every((w) => text.toLowerCase().includes(w))

  // Connection: close, come negli altri finti: niente socket keep-alive
  // riusati da Playwright dopo che il server li ha chiusi.
  app.use('*', async (c, next) => {
    await next()
    c.header('Connection', 'close')
  })
  app.get('/__fake/health', (c) => c.json({ ok: true }))
  app.post('/__fake/state', async (c) => {
    Object.assign(state, await c.req.json())
    return c.json(state)
  })
  app.post('/__fake/reset', (c) => {
    Object.assign(state, { off: true, usda: true, calls: [] })
    return c.json(state)
  })

  for (const [prefix, country] of [
    ['/off', 'world'],
    ['/off-it', 'it'],
  ] as const) {
    app.get(`${prefix}/cgi/search.pl`, (c) => {
      state.calls.push(`${prefix} ${c.req.query('search_terms')}`)
      if (!state.off) return c.json({ error: 'giù' }, 503)
      const q = c.req.query('search_terms') ?? ''
      const products = OFF_PRODUCTS.filter(
        (p) => p.countries.includes(country) && matches(`${p.product_name} ${p.brands ?? ''}`, q),
      )
      return c.json({ count: products.length, products })
    })
    app.get(`${prefix}/api/v2/product/:file`, (c) => {
      if (!state.off) return c.json({ error: 'giù' }, 503)
      const code = c.req.param('file').replace(/\.json$/, '')
      const product = OFF_PRODUCTS.find((p) => p.code === code)
      return product ? c.json({ status: 1, product }) : c.json({ status: 0 }, 404)
    })
  }

  app.get('/usda/foods/search', (c) => {
    state.calls.push(`/usda ${c.req.query('query')}`)
    if (!state.usda) return c.json({ error: 'giù' }, 503)
    const q = c.req.query('query') ?? ''
    // USDA è in inglese: "yogurt greco" trova "greek yogurt" solo per "yogurt".
    const words = q.toLowerCase().split(/\s+/)
    const foods = USDA_FOODS.filter((f) => words.some((w) => f.description.toLowerCase().includes(w)))
    return c.json({ foods })
  })

  return {
    app,
    state,
    fetch: (input: string | URL | Request, init?: RequestInit) => app.request(input, init),
  }
}

export const FAKE_FOODS_CONFIG = (base = 'http://foods.test') => ({
  offUrl: `${base}/off`,
  offItalyUrl: `${base}/off-it`,
  usdaUrl: `${base}/usda`,
  usdaKey: 'DEMO_KEY',
})

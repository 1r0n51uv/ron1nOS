// Ricerca su OpenFoodFacts e USDA FoodData Central (ADR-0018 e ADR-0036 di
// 1r0-pkm, foodsearch.js): OpenFoodFacts per i prodotti confezionati e i
// codici a barre, USDA per gli alimenti generici. I risultati sono
// candidati: entrano nel catalogo solo quando si usano.
import type { FoodCandidate } from './foods.ts'

export type ExternalConfig = {
  offUrl: string // ricerca mondiale
  offItalyUrl: string // filtro Solo Italia (it.openfoodfacts.org)
  usdaUrl: string
  usdaKey: string
}

export type ExternalSearch = {
  off(q: string, opts: { limit: number; italy: boolean }): Promise<FoodCandidate[] | null>
  usda(q: string, opts: { limit: number }): Promise<FoodCandidate[] | null>
  offBarcode(code: string): Promise<FoodCandidate | null | undefined>
}

const UA = 'ron1nOS/1.0 (github.com/1r0n51uv/ron1nOS)'
const OFF_FIELDS = 'code,product_name,generic_name,brands,serving_quantity,nutriments'

const round1 = (n: number) => Math.round(n * 10) / 10
const posNum = (v: unknown) => {
  const n = Number(v)
  return v !== null && v !== undefined && v !== '' && Number.isFinite(n) && n >= 0 ? n : null
}

type OffProduct = {
  code?: string
  product_name?: string
  generic_name?: string
  brands?: string
  serving_quantity?: unknown
  nutriments?: Record<string, unknown>
}

export function fromOff(p: OffProduct): FoodCandidate | null {
  const n = p.nutriments ?? {}
  let kcal = posNum(n['energy-kcal_100g'])
  const kj = posNum(n['energy_100g'])
  if (kcal === null && kj !== null) kcal = kj / 4.184
  const name = (p.product_name || p.generic_name || '').trim()
  if (!name || kcal === null) return null
  const brand = (p.brands ?? '').split(',')[0]?.trim() || null
  const caffeine = posNum(n['caffeine_100g'])
  return {
    source: 'openfoodfacts',
    externalId: p.code ?? null,
    barcode: p.code && /^\d{6,14}$/.test(p.code) ? p.code : null,
    name,
    brand,
    servingSizeG: posNum(p.serving_quantity),
    kcal: round1(kcal),
    protein: round1(posNum(n['proteins_100g']) ?? 0),
    carbs: round1(posNum(n['carbohydrates_100g']) ?? 0),
    fat: round1(posNum(n['fat_100g']) ?? 0),
    // OpenFoodFacts dà la caffeina in g per 100 g.
    caffeineMg: caffeine === null ? null : round1(caffeine * 1000),
  }
}

type UsdaFood = {
  fdcId?: number
  description?: string
  brandOwner?: string
  brandName?: string
  foodNutrients?: { nutrientName?: string; unitName?: string; value?: unknown }[]
}

const USDA_NUTRIENT: Record<string, 'kcal' | 'protein' | 'carbs' | 'fat'> = {
  Energy: 'kcal',
  Protein: 'protein',
  'Carbohydrate, by difference': 'carbs',
  'Total lipid (fat)': 'fat',
}

export function fromUsda(f: UsdaFood): FoodCandidate | null {
  const name = (f.description ?? '').trim()
  if (!name) return null
  const out: { kcal: number | null; protein: number; carbs: number; fat: number } = {
    kcal: null,
    protein: 0,
    carbs: 0,
    fat: 0,
  }
  for (const fn of f.foodNutrients ?? []) {
    const key = USDA_NUTRIENT[fn.nutrientName ?? '']
    const val = posNum(fn.value)
    if (!key || val === null) continue
    if (key === 'kcal') {
      // Alcune righe Energy sono in kJ: si preferisce quella in kcal.
      if (/^kj$/i.test(fn.unitName ?? '')) out.kcal ??= val / 4.184
      else out.kcal = val
    } else out[key] = val
  }
  if (out.kcal === null) return null
  return {
    source: 'usda',
    externalId: f.fdcId !== undefined ? String(f.fdcId) : null,
    barcode: null,
    name: name.charAt(0).toUpperCase() + name.slice(1).toLowerCase(),
    brand: (f.brandOwner || f.brandName || '').trim() || null,
    servingSizeG: null,
    kcal: round1(out.kcal),
    protein: round1(out.protein),
    carbs: round1(out.carbs),
    fat: round1(out.fat),
    caffeineMg: null,
  }
}

export function createExternalSearch(
  config: ExternalConfig,
  { fetch: doFetch = fetch, timeoutMs = 8_000 }: { fetch?: typeof fetch; timeoutMs?: number } = {},
): ExternalSearch {
  // null se la fonte non risponde: la ricerca continua con le altre.
  async function json(url: string): Promise<{ status: number; body: unknown } | null> {
    try {
      const res = await doFetch(url, {
        headers: { 'User-Agent': UA, Accept: 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (res.status === 404) return { status: 404, body: null }
      if (!res.ok) return null
      return { status: res.status, body: await res.json() }
    } catch {
      return null
    }
  }

  return {
    async off(q, { limit, italy }) {
      const base = italy ? config.offItalyUrl : config.offUrl
      const params = new URLSearchParams({
        search_terms: q,
        search_simple: '1',
        action: 'process',
        json: '1',
        page_size: String(limit),
        fields: OFF_FIELDS,
      })
      const r = await json(`${base}/cgi/search.pl?${params}`)
      if (!r) return null
      const products = (r.body as { products?: OffProduct[] } | null)?.products ?? []
      return products.map(fromOff).filter((x) => x !== null)
    },

    async usda(q, { limit }) {
      const params = new URLSearchParams({
        api_key: config.usdaKey,
        query: q,
        pageSize: String(limit),
        dataType: 'Foundation,SR Legacy,Survey (FNDDS)',
      })
      const r = await json(`${config.usdaUrl}/foods/search?${params}`)
      if (!r) return null
      const foods = (r.body as { foods?: UsdaFood[] } | null)?.foods ?? []
      return foods.map(fromUsda).filter((x) => x !== null)
    },

    // undefined se OpenFoodFacts non risponde, null se il codice non c'è.
    async offBarcode(code) {
      const r = await json(
        `${config.offUrl}/api/v2/product/${encodeURIComponent(code)}.json?fields=${OFF_FIELDS}`,
      )
      if (!r) return undefined
      const product = (r.body as { product?: OffProduct; status?: number } | null)?.product
      return product ? fromOff({ code, ...product }) : null
    },
  }
}

// Catalogo YAZIO nella ricerca (NUT-021): prodotti del paese IT in lingua
// it_IT, in coda a OpenFoodFacts e USDA. Un alimento preso da qui tiene il
// suo product_id, così l'invio a YAZIO (NUT-023) lo registra come prodotto.
import type { YazioClient } from '../yazio/client.ts'
import type { ProductSearchResult } from '../yazio/schemas.ts'
import type { FoodCandidate } from './foods.ts'

const LIMIT = 20
const round1 = (n: number) => Math.round(n * 10) / 10

// YAZIO dà i nutrienti per 1 g (o 1 ml): qui per 100.
export function fromYazioProduct(p: ProductSearchResult): FoodCandidate | null {
  const name = p.name.trim()
  if (!name) return null
  const per100 = (v: number) => round1(Math.max(0, v) * 100)
  return {
    source: 'yazio',
    externalId: p.product_id,
    barcode: null,
    name,
    brand: p.producer?.trim() || null,
    servingSizeG: null,
    kcal: per100(p.nutrients['energy.energy']),
    protein: per100(p.nutrients['nutrient.protein']),
    carbs: per100(p.nutrients['nutrient.carb']),
    fat: per100(p.nutrients['nutrient.fat']),
    caffeineMg: null,
    yazioProductId: p.product_id,
  }
}

// null se YAZIO non risponde: la ricerca continua con le altre fonti.
export function yazioSearch(client: YazioClient) {
  return async (q: string): Promise<FoodCandidate[] | null> => {
    try {
      const list = await client.searchProducts(q)
      // YAZIO mette in testa anche prodotti di altri paesi ("Banane" per
      // "pane"): restano solo quelli venduti in Italia.
      return list
        .filter((p) => !p.countries.length || p.countries.includes('IT'))
        .map(fromYazioProduct)
        .filter((c) => c !== null)
        .slice(0, LIMIT)
    } catch {
      return null
    }
  }
}

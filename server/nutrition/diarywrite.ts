// Scrittura sul diario YAZIO (NUT-023): quello che si registra in ron1nOS
// finisce anche in YAZIO. Una riga va inviata quando YAZIO non la conosce
// o ne sa una versione diversa (yazio_amount, yazio_daytime); le
// cancellazioni arrivano da yazio_deletions. Il giro legge prima il diario
// (NUT-022), così una voce cambiata in YAZIO vince e non si sovrascrive.
import type { Queryable } from '../db.ts'
import type { YazioClient } from '../yazio/client.ts'
import { YazioRequestError } from '../yazio/client.ts'
import type { ProductSearchResult } from '../yazio/schemas.ts'
import { addDays, today } from './dates.ts'
import { daytimeFor } from './diaryread.ts'
import type { FoodSource } from './foods.ts'
import { normalizeName } from './foods.ts'
import type { Slot } from './schemas.ts'
import type { SyncStep } from './yazio.ts'

// Righe e acqua dei giorni recenti: oltre, una riga mai inviata resta solo
// in ron1nOS.
export const WRITE_DAYS = 14
// Una cancellazione rifiutata da YAZIO si riprova poche volte.
const MAX_DELETE_ATTEMPTS = 5

type Row = {
  id: string
  day: string
  slot: Slot
  grams: number
  amount: number | null
  daytime: string | null
  sync: string
  foodId: string | null
  productId: string | null
  matchedBy: string | null
  source: FoodSource | null
  barcode: string | null
  name: string
  brand: string | null
}

// Da quale giorno si scrive: il primo giro riuscito, al più WRITE_DAYS fa.
async function windowStart(db: Queryable, day: string) {
  const { rows } = await db.query<{ first: Date | null }>(
    'select first_sync_at as first from yazio_status where id = 1',
  )
  const first = rows[0]?.first ? today(rows[0].first) : day
  const oldest = addDays(day, -(WRITE_DAYS - 1))
  return first > oldest ? first : oldest
}

async function rowsToSend(db: Queryable, from: string, to: string, retryErrors: boolean) {
  const { rows } = await db.query<Row>(
    `select i.id, e.day, e.slot, i.quantity_g as grams, i.yazio_amount as amount,
            i.yazio_daytime as daytime, i.yazio_sync as sync, f.id as "foodId",
            f.yazio_product_id as "productId", f.yazio_matched_by as "matchedBy", f.source, f.barcode,
            coalesce(f.name, i.food_name) as name, f.brand
       from meal_entry_items i
       join meal_entries e on e.id = i.meal_entry_id
       left join foods f on f.id = i.food_id
      where e.day between $1 and $2 and i.yazio_sync <> 'unmatched'
        and ($3 or i.yazio_sync <> 'error') and f.yazio_matched_by is distinct from 'local'
      order by e.day, e.slot, i.order_index`,
    [from, to, retryErrors],
  )
  return rows.filter((r) => r.amount !== r.grams || r.daytime !== daytimeFor(r.slot))
}

// Quante righe e cancellazioni aspettano l'invio (In coda verso YAZIO).
export async function queueSize(db: Queryable, day: string) {
  const from = await windowStart(db, day)
  const { rows } = await db.query<{ n: number }>('select count(*)::int as n from yazio_deletions')
  return (await rowsToSend(db, from, day, true)).length + rows[0].n
}

export async function hasPending(db: Queryable, day: string) {
  const from = await windowStart(db, day)
  if ((await rowsToSend(db, from, day, false)).length) return true
  const { rows } = await db.query<{ n: number }>('select count(*)::int as n from yazio_deletions')
  return rows[0].n > 0 || (await waterToSend(db, from, day)).length > 0
}

// Equivalente YAZIO di un alimento di OpenFoodFacts o USDA: per codice a
// barre se c'è, altrimenti per nome (e marca se YAZIO la dà).
const sameName = (a: string, b: string) => {
  const x = normalizeName(a)
  const y = normalizeName(b)
  return x === y || x.includes(y) || y.includes(x)
}

export async function findEquivalent(
  client: YazioClient,
  food: { name: string; brand: string | null; barcode: string | null },
): Promise<{ productId: string; by: 'barcode' | 'name' } | null> {
  const italian = (list: ProductSearchResult[]) =>
    list.filter((p) => !p.countries.length || p.countries.includes('IT'))
  if (food.barcode) {
    const [hit] = await client.searchProducts(food.barcode)
    if (hit) return { productId: hit.product_id, by: 'barcode' }
  }
  const hit = italian(await client.searchProducts(food.name)).find(
    (p) => sameName(p.name, food.name) && (!food.brand || !p.producer || sameName(p.producer, food.brand)),
  )
  return hit ? { productId: hit.product_id, by: 'name' } : null
}

// Il prodotto YAZIO di una riga; null se non ce n'è uno (senza equivalente).
async function productFor(db: Queryable, client: YazioClient, row: Row, cache: Map<string, string | null>) {
  if (row.productId) return row.productId
  if (!row.foodId || row.matchedBy === 'local') return null
  if (cache.has(row.foodId)) return cache.get(row.foodId)!
  // Gli alimenti personali non hanno un equivalente sicuro: si abbinano a mano.
  const match = row.source === 'custom' ? null : await findEquivalent(client, row)
  if (match) {
    await db.query(
      `update foods set yazio_product_id = $2, yazio_matched_by = $3, updated_at = now() where id = $1`,
      [row.foodId, match.productId, match.by],
    )
  }
  cache.set(row.foodId, match?.productId ?? null)
  return match?.productId ?? null
}

async function sendRows(db: Queryable, client: YazioClient, rows: Row[]) {
  const cache = new Map<string, string | null>()
  for (const row of rows) {
    const productId = await productFor(db, client, row, cache)
    if (!productId) {
      await db.query(`update meal_entry_items set yazio_sync = 'unmatched' where id = $1`, [row.id])
      continue
    }
    const daytime = daytimeFor(row.slot)
    try {
      // Lo stesso id per creare e per correggere: YAZIO sostituisce la voce.
      await client.addConsumedProducts([{ id: row.id, productId, date: row.day, daytime, amount: row.grams }])
    } catch (err) {
      // Rifiutata per un motivo suo (prodotto sparito…): la riga resta in
      // errore e si riprova al giro completo. Gli altri errori fermano il giro.
      if (!(err instanceof YazioRequestError)) throw err
      await db.query(`update meal_entry_items set yazio_sync = 'error' where id = $1`, [row.id])
      continue
    }
    await db.query(
      `update meal_entry_items set yazio_sync = 'synced', yazio_amount = $2, yazio_daytime = $3,
         yazio_synced_at = now() where id = $1`,
      [row.id, row.grams, daytime],
    )
  }
}

async function sendDeletions(db: Queryable, client: YazioClient) {
  const { rows } = await db.query<{ id: string }>('select item_id as id from yazio_deletions')
  if (!rows.length) return
  const ids = rows.map((r) => r.id)
  try {
    await client.deleteConsumedItems(ids)
  } catch (err) {
    if (!(err instanceof YazioRequestError)) throw err
    await db.query(
      `update yazio_deletions set attempts = attempts + 1, last_error = $2 where item_id = any($1)`,
      [ids, err.message],
    )
    await db.query('delete from yazio_deletions where attempts >= $1', [MAX_DELETE_ATTEMPTS])
    return
  }
  await db.query('delete from yazio_deletions where item_id = any($1)', [ids])
}

async function waterToSend(db: Queryable, from: string, to: string) {
  const { rows } = await db.query<{ day: string; total: number }>(
    `select l.day, sum(l.amount_ml) as total
       from water_logs l left join yazio_water w on w.day = l.day
      where l.day between $1 and $2
      group by l.day, w.total_ml
     having w.total_ml is distinct from sum(l.amount_ml)
     union all
     select w.day, 0 from yazio_water w
      where w.day between $1 and $2 and w.total_ml > 0
        and not exists (select 1 from water_logs l where l.day = w.day)`,
    [from, to],
  )
  return rows
}

// YAZIO vuole il totale del giorno, non l'aggiunta.
async function sendWater(db: Queryable, client: YazioClient, from: string, to: string) {
  for (const { day, total } of await waterToSend(db, from, to)) {
    await client.setWater(day, total)
    await db.query(
      `insert into yazio_water (day, total_ml) values ($1, $2)
       on conflict (day) do update set total_ml = excluded.total_ml`,
      [day, total],
    )
  }
}

function writeStep(retryErrors: boolean): SyncStep {
  return async ({ db, client, day }) => {
    const from = await windowStart(db, day)
    await sendDeletions(db, client)
    await sendRows(db, client, await rowsToSend(db, from, day, retryErrors))
    await sendWater(db, client, from, day)
  }
}

// Al giro completo si riprovano anche le righe in errore; all'invio di ogni
// minuto solo quelle nuove o cambiate.
export const writeDiary = writeStep(true)
export const flushDiary = writeStep(false)

// Lettura dal diario YAZIO (NUT-022): quello che si registra nell'app YAZIO
// compare in ron1nOS. A ogni giro gli ultimi 3 giorni; YAZIO vince sempre.
import type { Queryable } from '../db.ts'
import type { YazioClient } from '../yazio/client.ts'
import type { ConsumedProduct, Daytime } from '../yazio/schemas.ts'
import { addDays } from './dates.ts'
import type { Food } from './foods.ts'
import { ensureFood, FOOD_COLUMNS } from './foods.ts'
import { addItems, mealEntry, moveItem, removeItem, setGrams } from './meals.ts'
import type { Slot } from './schemas.ts'
import type { SyncStep } from './yazio.ts'
import { fromYazioDetail } from './yaziosearch.ts'

export const READ_DAYS = 3

// YAZIO ha 4 momenti: lo spuntino diventa Spuntino prima delle 15, Merenda
// dopo. L'ora è quella della voce in YAZIO.
export function slotFor(daytime: Daytime, date: string): Slot {
  if (daytime !== 'snack') return daytime
  const hour = Number(date.slice(11, 13))
  return Number.isFinite(hour) && hour >= 15 ? 'afternoon_snack' : 'morning_snack'
}

// Il momento YAZIO di uno slot di ron1nOS (anche per l'invio, NUT-023).
export function daytimeFor(slot: Slot): Daytime {
  return slot === 'morning_snack' || slot === 'afternoon_snack' ? 'snack' : slot
}

type LocalRow = {
  id: string
  day: string
  slot: Slot
  grams: number
  amount: number | null
  daytime: string | null
}

async function localRows(db: Queryable, from: string, to: string) {
  const { rows } = await db.query<LocalRow>(
    `select i.id, e.day, e.slot, i.quantity_g as grams, i.yazio_amount as amount, i.yazio_daytime as daytime
       from meal_entry_items i join meal_entries e on e.id = i.meal_entry_id
      where e.day between $1 and $2`,
    [from, to],
  )
  return rows
}

async function rowById(db: Queryable, id: string) {
  const { rows } = await db.query<LocalRow>(
    `select i.id, e.day, e.slot, i.quantity_g as grams, i.yazio_amount as amount, i.yazio_daytime as daytime
       from meal_entry_items i join meal_entries e on e.id = i.meal_entry_id where i.id = $1`,
    [id],
  )
  return rows[0] ?? null
}

// L'alimento di un prodotto YAZIO: uno già abbinato, altrimenti la scheda
// del prodotto entra nel catalogo. null se YAZIO non lo conosce più.
async function foodFor(db: Queryable, client: YazioClient, productId: string): Promise<Food | null> {
  const { rows } = await db.query<Food>(
    `select ${FOOD_COLUMNS} from foods where yazio_product_id = $1 order by (source = 'yazio') desc limit 1`,
    [productId],
  )
  if (rows[0]) return rows[0]
  const product = await client.product(productId)
  const candidate = product && fromYazioDetail(product)
  return candidate ? ensureFood(db, candidate) : null
}

async function applyRemote(db: Queryable, client: YazioClient, p: ConsumedProduct, day: string) {
  const slot = slotFor(p.daytime, p.date)
  const row = await rowById(db, p.id)
  if (!row) {
    const food = await foodFor(db, client, p.product_id)
    if (!food) return
    const mealId = await mealEntry(db, day, slot)
    await addItems(db, mealId, [{ food, grams: p.amount }], {
      sync: 'synced',
      yazio: { id: p.id, daytime: p.daytime },
    })
    return
  }
  // Uguale all'ultima volta: YAZIO non l'ha toccata, resta la riga locale
  // (con l'eventuale modifica in coda per l'invio).
  if (row.amount === p.amount && row.daytime === p.daytime && row.day === day) return
  // Cambiata in YAZIO: vince YAZIO, la modifica locale in coda si scarta.
  if (row.grams !== p.amount) await setGrams(db, p.id, p.amount)
  if (row.day !== day || daytimeFor(row.slot) !== p.daytime) await moveItem(db, p.id, day, slot)
  await db.query(
    `update meal_entry_items set yazio_amount = $2, yazio_daytime = $3, yazio_sync = 'synced',
       yazio_synced_at = now() where id = $1`,
    [p.id, p.amount, p.daytime],
  )
}

// Acqua: vale il totale del giorno di YAZIO quando è cambiato lì. La prima
// volta uno zero di YAZIO non cancella l'acqua già segnata qui: la porta
// l'invio (NUT-023).
async function applyWater(db: Queryable, day: string, total: number) {
  const { rows } = await db.query<{ seen: number }>(
    'select total_ml as seen from yazio_water where day = $1',
    [day],
  )
  const seen = rows[0]?.seen
  if (seen === total) return
  if (seen !== undefined || total > 0) {
    await db.query('delete from water_logs where day = $1', [day])
    if (total > 0) await db.query('insert into water_logs (day, amount_ml) values ($1, $2)', [day, total])
  }
  await db.query(
    `insert into yazio_water (day, total_ml) values ($1, $2)
     on conflict (day) do update set total_ml = excluded.total_ml`,
    [day, total],
  )
}

export const readDiary: SyncStep = async ({ db, client, day }) => {
  const days = Array.from({ length: READ_DAYS }, (_, i) => addDays(day, i - (READ_DAYS - 1)))
  // Prima tutto quello che dice YAZIO, poi le modifiche: una voce spostata
  // da un giorno all'altro non sembra cancellata.
  const remote = new Map<string, { p: ConsumedProduct; day: string }>()
  const water = new Map<string, number>()
  for (const d of days) {
    for (const p of (await client.consumedItems(d)).products) remote.set(p.id, { p, day: d })
    water.set(d, await client.water(d))
  }
  const { rows: deleting } = await db.query<{ id: string }>('select item_id as id from yazio_deletions')
  const pendingDelete = new Set(deleting.map((r) => r.id))

  await db.tx(async (tx) => {
    for (const { p, day: d } of remote.values()) {
      if (!pendingDelete.has(p.id)) await applyRemote(tx, client, p, d)
    }
    // Una riga che YAZIO conosceva e non c'è più è stata cancellata lì.
    for (const row of await localRows(tx, days[0], days.at(-1)!)) {
      if (row.amount === null || remote.has(row.id)) continue
      // Già cancellata in YAZIO: non va in coda per cancellarla di nuovo.
      await tx.query('update meal_entry_items set yazio_amount = null where id = $1', [row.id])
      await removeItem(tx, row.id)
    }
    for (const [d, total] of water) await applyWater(tx, d, total)
  })
}

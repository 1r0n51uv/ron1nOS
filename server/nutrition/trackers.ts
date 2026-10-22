// Contatori del giorno: acqua (NUT-012) e caffeina (NUT-013). Il `-`
// annulla l'ultima voce del giorno, non toglie una quantità fissa
// (ADR-0037). La caffeina dei pasti non si tocca da qui.
import type { Queryable } from '../db.ts'

export async function addWater(db: Queryable, day: string, ml: number) {
  await db.query('insert into water_logs (day, amount_ml) values ($1, $2)', [day, ml])
}

export async function undoWater(db: Queryable, day: string) {
  await db.query(
    `delete from water_logs where id = (
       select id from water_logs where day = $1 order by logged_at desc, id desc limit 1)`,
    [day],
  )
}

export async function addCaffeine(db: Queryable, day: string, mg: number, source: string) {
  await db.query('insert into caffeine_logs (day, caffeine_mg, source_name) values ($1, $2, $3)', [
    day,
    mg,
    source,
  ])
}

export async function undoCaffeine(db: Queryable, day: string) {
  await db.query(
    `delete from caffeine_logs where id = (
       select id from caffeine_logs where day = $1 order by logged_at desc, id desc limit 1)`,
    [day],
  )
}

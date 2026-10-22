// Contatori del giorno: acqua (NUT-012). Il `-` annulla l'ultima voce del
// giorno, non toglie una quantità fissa (ADR-0037).
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

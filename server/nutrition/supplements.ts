// Integratori (NUT-014): un elenco con nome, dose e quando. Ogni giorno si
// spuntano quelli presi. Uno disattivato esce dalla checklist dei giorni
// in cui non è stato preso; eliminarlo cancella anche le spunte.
import type { Queryable } from '../db.ts'
import { NotFoundError } from './http.ts'

export type Supplement = {
  id: string
  name: string
  dose: string | null
  schedule: string | null
  active: boolean
}

export type SupplementInput = { name: string; dose: string | null; schedule: string | null }

export type DaySupplement = Omit<Supplement, 'active'> & { taken: boolean }

const COLUMNS = 'id, name, dose_text as dose, schedule_text as schedule, active'

export async function listSupplements(db: Queryable): Promise<Supplement[]> {
  const { rows } = await db.query<Supplement>(
    `select ${COLUMNS} from supplements order by active desc, created_at, id`,
  )
  return rows
}

export async function createSupplement(db: Queryable, s: SupplementInput): Promise<Supplement> {
  const { rows } = await db.query<Supplement>(
    `insert into supplements (name, dose_text, schedule_text) values ($1, $2, $3) returning ${COLUMNS}`,
    [s.name, s.dose, s.schedule],
  )
  return rows[0]
}

const FIELDS = { name: 'name', dose: 'dose_text', schedule: 'schedule_text', active: 'active' } as const

export async function updateSupplement(
  db: Queryable,
  id: string,
  patch: Partial<SupplementInput & { active: boolean }>,
): Promise<Supplement> {
  const keys = (Object.keys(FIELDS) as (keyof typeof FIELDS)[]).filter((k) => patch[k] !== undefined)
  const sets = keys.map((k, i) => `${FIELDS[k]} = $${i + 2}`)
  const { rows } = await db.query<Supplement>(
    `update supplements set ${sets.length ? sets.join(', ') : 'id = id'} where id = $1 returning ${COLUMNS}`,
    [id, ...keys.map((k) => patch[k])],
  )
  if (!rows[0]) throw new NotFoundError('Integratore non trovato')
  return rows[0]
}

export async function deleteSupplement(db: Queryable, id: string) {
  const { rowCount } = await db.query('delete from supplements where id = $1', [id])
  if (!rowCount) throw new NotFoundError('Integratore non trovato')
}

// La spunta del giorno: presa o no.
export async function setTaken(db: Queryable, id: string, day: string, taken: boolean) {
  if (!(await db.query('select 1 from supplements where id = $1', [id])).rowCount) {
    throw new NotFoundError('Integratore non trovato')
  }
  await db.query(
    taken
      ? 'insert into supplement_logs (supplement_id, day) values ($1, $2) on conflict do nothing'
      : 'delete from supplement_logs where supplement_id = $1 and day = $2',
    [id, day],
  )
}

// La checklist di un giorno: gli attivi più quelli presi quel giorno.
export async function daySupplements(db: Queryable, day: string): Promise<DaySupplement[]> {
  const { rows } = await db.query<DaySupplement>(
    `select s.id, s.name, s.dose_text as dose, s.schedule_text as schedule, l.day is not null as taken
       from supplements s left join supplement_logs l on l.supplement_id = s.id and l.day = $1
      where s.active or l.day is not null
      order by s.created_at, s.id`,
    [day],
  )
  return rows
}

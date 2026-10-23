// Backup della configurazione (SET-011): preferenze e layout di tutti i
// dispositivi in un JSON con una versione di formato. Niente dati dei
// moduli, niente segreti, niente immagine di sfondo.
import { z } from 'zod'

import type { Queryable } from '../db.ts'
import type { Device } from '../dashboard/layout.ts'
import { DEVICES, getLayout, Layout, putLayout, validateLayout } from '../dashboard/layout.ts'
import { InvalidRequestError } from '../nutrition/http.ts'
import { hasBackground } from './background.ts'
import type { Preferences as PreferencesType } from './schema.ts'
import { DEFAULT_PREFERENCES, Preferences } from './schema.ts'
import { getPreferences, patchPreferences } from './store.ts'

export const BACKUP_FORMAT = 1

export const Backup = z.object({
  app: z.literal('ron1nOS'),
  format: z.literal(BACKUP_FORMAT),
  exportedAt: z.string(),
  preferences: Preferences,
  layouts: z.object({ desktop: Layout, iphone: Layout }).partial(),
})

export type Backup = z.infer<typeof Backup>

const DEVICE_LABELS: Record<Device, string> = { desktop: 'computer', iphone: 'iPhone' }

const GROUPS: [keyof PreferencesType, string][] = [
  ['appearance', 'Aspetto'],
  ['disabledModules', 'Moduli accesi e spenti'],
  ['navOrder', 'Ordine della barra'],
  ['formats', 'Formati'],
]

// Confronto senza badare all'ordine delle chiavi, che jsonb non conserva.
const canonical = (v: unknown): unknown =>
  Array.isArray(v)
    ? v.map(canonical)
    : v && typeof v === 'object'
      ? Object.fromEntries(
          Object.entries(v)
            .filter(([, x]) => x !== undefined)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, x]) => [k, canonical(x)]),
        )
      : v
const same = (a: unknown, b: unknown) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b))
const shape = (l: Layout) => ({ header: l.header, items: l.items })

export async function exportBackup(db: Queryable, now = new Date()): Promise<Backup> {
  const { updatedAt: _, ...preferences } = await getPreferences(db)
  const layouts: Backup['layouts'] = {}
  for (const device of DEVICES) layouts[device] = shape(await getLayout(db, device))
  return { app: 'ron1nOS', format: BACKUP_FORMAT, exportedAt: now.toISOString(), preferences, layouts }
}

// Il file letto e controllato: forma con zod, layout con le regole della
// dashboard. Un formato diverso si rifiuta con un messaggio chiaro.
export function readBackup(raw: unknown): Backup {
  const head = (typeof raw === 'object' && raw ? raw : {}) as Record<string, unknown>
  if (head.app !== 'ron1nOS') throw new InvalidRequestError('Il file non è un backup di ron1nOS')
  if (head.format !== BACKUP_FORMAT) throw new InvalidRequestError('Versione del backup non supportata')
  const result = Backup.safeParse(raw)
  if (!result.success) {
    const where = result.error.issues[0]?.path.join('.')
    throw new InvalidRequestError(where ? `Backup non valido: ${where}` : 'Backup non valido')
  }
  for (const device of DEVICES) {
    const layout = result.data.layouts[device]
    if (layout) validateLayout(layout)
  }
  return result.data
}

export type ImportPlan = { changes: string[]; notes: string[]; applied: boolean }

// Cosa cambierebbe importando il backup; con `apply` lo scrive.
export async function importBackup(db: Queryable, backup: Backup, apply: boolean): Promise<ImportPlan> {
  const current = await getPreferences(db)
  const preferences = { ...backup.preferences }
  const notes: string[] = []
  // L'immagine non viaggia nel file: senza quella sul server torna lo sfondo predefinito.
  if (preferences.appearance.background === 'image' && !(await hasBackground(db))) {
    preferences.appearance = {
      ...preferences.appearance,
      background: DEFAULT_PREFERENCES.appearance.background,
    }
    notes.push('Lo sfondo era un’immagine, che non è nel file: torna quello predefinito.')
  }
  const changes = GROUPS.filter(([key]) => !same(current[key], preferences[key])).map(([, label]) => label)
  const layouts: [Device, Layout][] = []
  for (const device of DEVICES) {
    const next = backup.layouts[device]
    if (!next) continue
    if (!same(shape(await getLayout(db, device)), shape(next))) {
      changes.push(`Dashboard · ${DEVICE_LABELS[device]}`)
      layouts.push([device, next])
    }
  }
  if (apply && changes.length) {
    await patchPreferences(db, preferences)
    for (const [device, layout] of layouts) await putLayout(db, device, layout)
  }
  return { changes, notes, applied: apply && changes.length > 0 }
}

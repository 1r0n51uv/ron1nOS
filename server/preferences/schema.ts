// Preferenze di ron1nOS (docs/specs/settings.md, SET-002): aspetto, moduli
// spenti, ordine della navigazione e formati. Il backend le valida, la
// dashboard web importa da qui tipi e predefiniti.
import { z } from 'zod'

import { MODULES } from '../dashboard/catalog.ts'
import { SLOTS } from '../nutrition/schemas.ts'

export const BACKGROUNDS = ['brace', 'nebbia', 'grafite', 'nero', 'image'] as const
export const GLASS = ['light', 'medium', 'strong'] as const
export const DENSITY = ['comfortable', 'compact'] as const
// Le voci della barra che si possono spostare: Dashboard resta prima e
// Impostazioni ultima (SET-006).
export const NAV_ITEMS = ['pasti', 'allenamenti', 'documenti', 'note', 'casa', 'server'] as const

const TimeZone = z.string().refine((tz) => {
  try {
    new Intl.DateTimeFormat('it-IT', { timeZone: tz })
    return true
  } catch {
    return false
  }
}, 'Fuso orario sconosciuto')

const unique = <T>(list: readonly T[]) => new Set(list).size === list.length

// Orari dei promemoria (NUT-027): `HH:MM`, 24 ore. Le notifiche le programma
// l'app iOS; il backend salva solo gli orari.
const Time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Orario non valido, atteso HH:MM')

export const Reminders = z.object({
  meals: z.object(
    Object.fromEntries(SLOTS.map((slot) => [slot, Time])) as Record<(typeof SLOTS)[number], typeof Time>,
  ),
  water: z
    .array(Time)
    .max(12)
    .refine(unique, 'Orari ripetuti')
    .transform((list) => [...list].sort()),
})

export const DEFAULT_REMINDERS: z.infer<typeof Reminders> = {
  meals: {
    breakfast: '07:30',
    morning_snack: '10:30',
    lunch: '13:00',
    afternoon_snack: '16:30',
    dinner: '20:00',
  },
  water: ['10:00', '13:00', '16:00', '19:00'],
}

export const Preferences = z.object({
  appearance: z.object({
    background: z.enum(BACKGROUNDS),
    glass: z.enum(GLASS),
    density: z.enum(DENSITY),
  }),
  disabledModules: z.array(z.enum(MODULES)).refine(unique, 'Moduli ripetuti'),
  navOrder: z
    .array(z.enum(NAV_ITEMS))
    .refine((list) => unique(list) && list.length === NAV_ITEMS.length, 'Ordine incompleto'),
  formats: z.object({
    timeZone: TimeZone,
    weightUnit: z.enum(['kg', 'lb']),
    energyUnit: z.enum(['kcal', 'kJ']),
  }),
  reminders: Reminders,
})

export type Preferences = z.infer<typeof Preferences>

// PATCH: ogni gruppo è facoltativo, e dentro aspetto e formati ogni campo.
export const PreferencesPatch = z
  .object({
    appearance: Preferences.shape.appearance.partial(),
    disabledModules: Preferences.shape.disabledModules,
    navOrder: Preferences.shape.navOrder,
    formats: Preferences.shape.formats.partial(),
    reminders: z
      .object({ meals: Reminders.shape.meals.partial().strict(), water: Reminders.shape.water })
      .partial()
      .strict(),
  })
  .partial()
  .strict()

export type PreferencesPatch = z.infer<typeof PreferencesPatch>

export const DEFAULT_PREFERENCES: Preferences = {
  appearance: { background: 'brace', glass: 'medium', density: 'comfortable' },
  disabledModules: [],
  navOrder: [...NAV_ITEMS],
  formats: { timeZone: 'Europe/Rome', weightUnit: 'kg', energyUnit: 'kcal' },
  reminders: DEFAULT_REMINDERS,
}

export function applyPatch(current: Preferences, patch: PreferencesPatch): Preferences {
  return {
    appearance: { ...current.appearance, ...patch.appearance },
    disabledModules: patch.disabledModules ?? current.disabledModules,
    navOrder: patch.navOrder ?? current.navOrder,
    formats: { ...current.formats, ...patch.formats },
    reminders: {
      meals: { ...current.reminders.meals, ...patch.reminders?.meals },
      water: patch.reminders?.water ?? current.reminders.water,
    },
  }
}

// Un documento salvato da una versione precedente: i campi mancanti o non
// più validi tornano ai predefiniti, le voci nuove della barra vanno in fondo.
export function normalize(saved: unknown): Preferences {
  const raw = (typeof saved === 'object' && saved ? saved : {}) as Record<string, unknown>
  const pick = <T>(schema: z.ZodType<T>, value: unknown, fallback: T) => {
    const result = schema.safeParse(value)
    return result.success ? result.data : fallback
  }
  const appearance = (raw.appearance ?? {}) as Record<string, unknown>
  const formats = (raw.formats ?? {}) as Record<string, unknown>
  const reminders = (raw.reminders ?? {}) as Record<string, unknown>
  const meals = (reminders.meals ?? {}) as Record<string, unknown>
  const d = DEFAULT_PREFERENCES
  const known = (Array.isArray(raw.navOrder) ? raw.navOrder : []).filter(
    (id, i, list): id is (typeof NAV_ITEMS)[number] =>
      (NAV_ITEMS as readonly unknown[]).includes(id) && list.indexOf(id) === i,
  )
  return {
    appearance: {
      background: pick(z.enum(BACKGROUNDS), appearance.background, d.appearance.background),
      glass: pick(z.enum(GLASS), appearance.glass, d.appearance.glass),
      density: pick(z.enum(DENSITY), appearance.density, d.appearance.density),
    },
    disabledModules: pick(Preferences.shape.disabledModules, raw.disabledModules, d.disabledModules),
    navOrder: [...known, ...NAV_ITEMS.filter((id) => !known.includes(id))],
    formats: {
      timeZone: pick(TimeZone, formats.timeZone, d.formats.timeZone),
      weightUnit: pick(z.enum(['kg', 'lb']), formats.weightUnit, d.formats.weightUnit),
      energyUnit: pick(z.enum(['kcal', 'kJ']), formats.energyUnit, d.formats.energyUnit),
    },
    reminders: {
      meals: Object.fromEntries(
        SLOTS.map((slot) => [slot, pick(Time, meals[slot], d.reminders.meals[slot])]),
      ) as Preferences['reminders']['meals'],
      water: pick(Reminders.shape.water, reminders.water, d.reminders.water),
    },
  }
}

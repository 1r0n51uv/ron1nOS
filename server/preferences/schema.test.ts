import { describe, expect, it } from 'vitest'

import {
  applyPatch,
  DEFAULT_PREFERENCES,
  NAV_ITEMS,
  normalize,
  Preferences,
  PreferencesPatch,
} from './schema.ts'

describe('preferenze (SET-002)', () => {
  it('i predefiniti sono validi', () => {
    expect(Preferences.safeParse(DEFAULT_PREFERENCES).success).toBe(true)
  })

  it('una modifica tocca solo i campi che porta', () => {
    const next = applyPatch(DEFAULT_PREFERENCES, {
      appearance: { glass: 'strong' },
      formats: { weightUnit: 'lb' },
    })
    expect(next.appearance).toEqual({ background: 'brace', glass: 'strong', density: 'comfortable' })
    expect(next.formats).toEqual({ timeZone: 'Europe/Rome', weightUnit: 'lb', energyUnit: 'kcal' })
    expect(next.navOrder).toEqual(DEFAULT_PREFERENCES.navOrder)
  })

  it('rifiuta campi sconosciuti, valori fuori elenco e ordini incompleti', () => {
    expect(PreferencesPatch.safeParse({ theme: 'dark' }).success).toBe(false)
    expect(PreferencesPatch.safeParse({ appearance: { glass: 'opaco' } }).success).toBe(false)
    expect(PreferencesPatch.safeParse({ navOrder: ['pasti'] }).success).toBe(false)
    expect(PreferencesPatch.safeParse({ disabledModules: ['notes', 'notes'] }).success).toBe(false)
    expect(PreferencesPatch.safeParse({ formats: { timeZone: 'Marte/Base' } }).success).toBe(false)
  })

  it('normalize riporta ai predefiniti i campi mancanti o non più validi', () => {
    expect(normalize(null)).toEqual(DEFAULT_PREFERENCES)
    const saved = {
      appearance: { background: 'nero', glass: 'vecchio' },
      disabledModules: ['notes'],
      navOrder: ['server', 'pasti', 'sparito'],
      formats: { energyUnit: 'kJ' },
    }
    const out = normalize(saved)
    expect(out.appearance).toEqual({ background: 'nero', glass: 'medium', density: 'comfortable' })
    expect(out.disabledModules).toEqual(['notes'])
    // Le voci note restano in testa, quelle nuove vanno in fondo.
    expect(out.navOrder).toEqual([
      'server',
      'pasti',
      ...NAV_ITEMS.filter((n) => n !== 'server' && n !== 'pasti'),
    ])
    expect(out.formats).toEqual({ timeZone: 'Europe/Rome', weightUnit: 'kg', energyUnit: 'kJ' })
  })

  it('ha gli orari dei promemoria predefiniti (NUT-027)', () => {
    expect(DEFAULT_PREFERENCES.reminders).toEqual({
      meals: {
        breakfast: '07:30',
        morning_snack: '10:30',
        lunch: '13:00',
        afternoon_snack: '16:30',
        dinner: '20:00',
      },
      water: ['10:00', '13:00', '16:00', '19:00'],
    })
  })

  it('cambia un orario dei pasti senza toccare gli altri e ordina quelli dell’acqua', () => {
    const patch = PreferencesPatch.parse({
      reminders: { meals: { lunch: '12:45' }, water: ['18:00', '09:30'] },
    })
    const next = applyPatch(DEFAULT_PREFERENCES, patch)
    expect(next.reminders.meals).toMatchObject({ breakfast: '07:30', lunch: '12:45' })
    expect(next.reminders.water).toEqual(['09:30', '18:00'])
    expect(applyPatch(DEFAULT_PREFERENCES, { reminders: { water: [] } }).reminders.water).toEqual([])
  })

  it('rifiuta orari non validi, ripetuti, slot sconosciuti e troppi avvisi', () => {
    for (const reminders of [
      { meals: { lunch: '25:00' } },
      { meals: { lunch: '7:30' } },
      { meals: { brunch: '11:00' } },
      { water: ['10:00', '10:00'] },
      { water: Array.from({ length: 13 }, (_, i) => `${String(i + 8).padStart(2, '0')}:00`) },
    ]) {
      expect(PreferencesPatch.safeParse({ reminders }).success).toBe(false)
    }
  })

  it('normalize completa i promemoria mancanti o non validi', () => {
    const out = normalize({ reminders: { meals: { dinner: '21:15', lunch: 'mezzogiorno' }, water: 'tante' } })
    expect(out.reminders.meals).toMatchObject({ dinner: '21:15', lunch: '13:00' })
    expect(out.reminders.water).toEqual(DEFAULT_PREFERENCES.reminders.water)
  })
})

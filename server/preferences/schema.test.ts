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
})

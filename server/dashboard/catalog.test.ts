// @vitest-environment node
import { describe, expect, it } from 'vitest'

import {
  IPHONE_SIZES,
  MODULES,
  WIDGET_CATALOG,
  catalogEntry,
  iphoneSize,
  optionsError,
  resolveOptions,
} from './catalog.ts'

describe('catalogo dei widget', () => {
  it('ha id unici nella forma <modulo>.<nome>', () => {
    const ids = WIDGET_CATALOG.map((w) => w.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const w of WIDGET_CATALOG) {
      expect(w.id).toMatch(/^[a-z]+\.[a-z-]+$/)
      expect(w.id.split('.')[0]).toBe(w.module)
      expect(MODULES).toContain(w.module)
    }
  })

  it('ha dimensioni dentro la griglia e predefinite tra minima e massima', () => {
    for (const { size } of WIDGET_CATALOG) {
      expect(size.max.w).toBeLessThanOrEqual(24)
      for (const k of ['w', 'h'] as const) {
        expect(size.min[k]).toBeGreaterThan(0)
        expect(size.min[k]).toBeLessThanOrEqual(size.default[k])
        expect(size.default[k]).toBeLessThanOrEqual(size.max[k])
      }
    }
  })

  it('trova una voce per id', () => {
    expect(catalogEntry('server.summary')?.module).toBe('server')
    expect(catalogEntry('server.nope')).toBeUndefined()
  })

  it('ha opzioni con chiavi uniche e predefiniti validi', () => {
    for (const entry of WIDGET_CATALOG) {
      const keys = (entry.options ?? []).map((o) => o.key)
      expect(new Set(keys).size).toBe(keys.length)
      expect(optionsError(entry, resolveOptions(entry))).toBeNull()
    }
  })

  it('completa le opzioni salvate con i predefiniti e scarta quelle non valide', () => {
    const entry = catalogEntry('downloads.summary')
    if (!entry) throw new Error('voce mancante')
    expect(resolveOptions(entry)).toEqual({ limit: 3 })
    expect(resolveOptions(entry, { limit: 5 })).toEqual({ limit: 5 })
    expect(resolveOptions(entry, { limit: 0 })).toEqual({ limit: 3 })
    expect(optionsError(entry, { altro: 1 })).toBe('opzione sconosciuta altro')
  })

  it('dichiara misure iPhone senza ripetizioni per i primi widget dell’app (DASH-010)', () => {
    const withIphone = WIDGET_CATALOG.filter((w) => w.iphone).map((w) => w.id)
    expect(withIphone).toEqual([
      'nutrition.summary',
      'workout.summary',
      'server.summary',
      'downloads.summary',
      'documents.summary',
      'nutrition.calories',
      'nutrition.next-meal',
      'nutrition.supplements',
      'server.metric',
      'downloads.speed',
    ])
    for (const w of WIDGET_CATALOG) {
      if (!w.iphone) continue
      expect(w.iphone.length).toBeGreaterThan(0)
      expect(new Set(w.iphone).size).toBe(w.iphone.length)
    }
  })

  it('riconosce le misure iPhone dalla dimensione in celle', () => {
    expect(IPHONE_SIZES.small).toEqual({ w: 2, h: 2 })
    expect(iphoneSize(4, 2)).toBe('medium')
    expect(iphoneSize(4, 4)).toBe('large')
    expect(iphoneSize(2, 4)).toBeNull()
  })
})

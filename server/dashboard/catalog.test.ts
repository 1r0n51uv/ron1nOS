// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { MODULES, WIDGET_CATALOG, catalogEntry } from './catalog.ts'

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
})

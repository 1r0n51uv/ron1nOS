import { describe, expect, it } from 'vitest'

import { WIDGET_CATALOG } from '../../server/dashboard/catalog.ts'
import { availableWidgets, findWidget, moduleWidgets, registry } from './registry'

describe('registro dei widget', () => {
  it('ha un componente per ogni voce del catalogo e nessuno in più', () => {
    const catalog = WIDGET_CATALOG.map((w) => w.id).sort()
    const declared = moduleWidgets.map((w) => w.id).sort()
    expect(declared).toEqual(catalog)
    expect(registry.map((w) => w.id)).toEqual(WIDGET_CATALOG.map((w) => w.id))
  })

  it('unisce titolo e componente alle dimensioni del catalogo', () => {
    const server = findWidget('server.summary')
    expect(server?.title).toBe('Server')
    expect(server?.module).toBe('server')
    expect(server?.size.default.w).toBeGreaterThan(0)
    expect(typeof server?.component).toBe('function')
  })

  it('lascia fuori i widget dei moduli spenti', () => {
    const ids = availableWidgets(['server', 'notes']).map((w) => w.id)
    expect(ids).not.toContain('server.summary')
    expect(ids).not.toContain('notes.summary')
    expect(ids).toContain('nutrition.summary')
    expect(availableWidgets()).toHaveLength(registry.length)
  })
})

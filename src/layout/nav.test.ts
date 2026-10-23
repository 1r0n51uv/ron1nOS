import { describe, expect, it } from 'vitest'

import { railItems, visibleRailItems } from './nav'

describe('barra con i moduli spenti (SET-005)', () => {
  it('senza moduli spenti ci sono tutte le voci', () => {
    expect(visibleRailItems([])).toEqual(railItems)
  })

  it('la voce di un modulo spento sparisce; Dashboard e Impostazioni restano', () => {
    const labels = visibleRailItems(['nutrition', 'server']).map((i) => i.label)
    expect(labels).not.toContain('Pasti')
    expect(labels).not.toContain('Server e container')
    expect(labels[0]).toBe('Dashboard')
    expect(labels.at(-1)).toBe('Impostazioni')
  })
})

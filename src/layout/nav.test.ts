import { describe, expect, it } from 'vitest'

import { moveItem, orderedRailItems, railItems, visibleRailItems } from './nav'

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

describe('ordine della barra (SET-006)', () => {
  it('segue l’ordine scelto, con Dashboard prima e Impostazioni ultima', () => {
    const labels = orderedRailItems(['server', 'casa', 'note', 'documenti', 'allenamenti', 'pasti']).map(
      (i) => i.label,
    )
    expect(labels).toEqual([
      'Dashboard',
      'Server e container',
      'Casa',
      'Note',
      'Documenti',
      'Allenamenti',
      'Pasti',
      'Impostazioni',
    ])
  })

  it('senza ordine vale il predefinito', () => {
    expect(orderedRailItems()).toEqual(railItems)
  })

  it('i moduli spenti spariscono anche dall’ordine scelto', () => {
    const labels = visibleRailItems(
      ['home'],
      ['casa', 'pasti', 'allenamenti', 'documenti', 'note', 'server'],
    ).map((i) => i.label)
    expect(labels.slice(0, 3)).toEqual(['Dashboard', 'Pasti', 'Allenamenti'])
  })
})

describe('moveItem', () => {
  it('sposta una voce e fa scorrere le altre', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd'])
    expect(moveItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b'])
  })

  it('fuori dai limiti lascia tutto com’è', () => {
    expect(moveItem(['a', 'b'], 0, -1)).toEqual(['a', 'b'])
    expect(moveItem(['a', 'b'], 1, 2)).toEqual(['a', 'b'])
  })
})

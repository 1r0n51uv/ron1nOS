import { describe, expect, it } from 'vitest'

import { buildTree, checkOf, selectedSize, toggle } from './tree'

const files = [
  { index: 0, path: 'dvd/disc-1.iso', size: 3_900 },
  { index: 1, path: 'dvd/disc-2.iso', size: 4_000 },
  { index: 2, path: 'dvd/extra/SHA256SUMS', size: 1 },
  { index: 3, path: 'dvd/extra/SHA256SUMS.sign', size: 1 },
]

describe('buildTree', () => {
  it('raggruppa per cartella con dimensioni e indici', () => {
    const [dvd] = buildTree(files)
    expect(dvd).toMatchObject({ name: 'dvd', size: 7_902, files: [0, 1, 2, 3] })
    expect(dvd.children.map((c) => c.name)).toEqual(['disc-1.iso', 'disc-2.iso', 'extra'])
    expect(dvd.children[2]).toMatchObject({ path: 'dvd/extra', files: [2, 3] })
    expect(dvd.children[0]).toMatchObject({ index: 0, children: [] })
  })

  it('un torrent di un solo file è un solo nodo', () => {
    expect(buildTree([{ index: 0, path: 'a.iso', size: 5 }])).toMatchObject([{ name: 'a.iso', index: 0 }])
  })
})

describe('selezione', () => {
  const [dvd] = buildTree(files)
  const extra = dvd.children[2]

  it('la cartella è parziale se solo alcuni file sono scelti', () => {
    expect(checkOf(dvd, new Set([0, 1, 2, 3]))).toBe(true)
    expect(checkOf(dvd, new Set([0]))).toBe('indeterminate')
    expect(checkOf(dvd, new Set())).toBe(false)
  })

  it('scegliere una cartella parziale sceglie tutto, una piena toglie tutto', () => {
    expect([...toggle(extra, new Set([0, 2]))].sort()).toEqual([0, 2, 3])
    expect([...toggle(extra, new Set([0, 2, 3]))]).toEqual([0])
  })

  it('somma solo i file scelti', () => {
    expect(selectedSize(files, new Set([0, 3]))).toBe(3_901)
  })
})

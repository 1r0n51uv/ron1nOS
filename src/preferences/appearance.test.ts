import { afterEach, describe, expect, it } from 'vitest'

import { DEFAULT_PREFERENCES } from '../../server/preferences/schema.ts'
import { applyAppearance } from './appearance'

const root = document.documentElement

describe('aspetto su <html> (SET-003)', () => {
  afterEach(() => {
    root.removeAttribute('style')
    for (const k of ['background', 'glass', 'density']) delete root.dataset[k]
  })

  it('i predefiniti: brace, vetro medio, densità comoda', () => {
    applyAppearance({ ...DEFAULT_PREFERENCES, backgroundImage: null })
    expect(root.dataset).toMatchObject({ background: 'brace', glass: 'medium', density: 'comfortable' })
    expect(root.style.getPropertyValue('--bg-image')).toBe('')
  })

  it('l’immagine caricata diventa una variabile CSS, con la versione nell’indirizzo', () => {
    applyAppearance({
      appearance: { background: 'image', glass: 'strong', density: 'compact' },
      backgroundImage: '2026-10-23T06:00:00.000Z',
    })
    expect(root.dataset).toMatchObject({ background: 'image', glass: 'strong', density: 'compact' })
    expect(root.style.getPropertyValue('--bg-image')).toBe(
      'url("/api/v1/preferences/background?v=2026-10-23T06%3A00%3A00.000Z")',
    )
  })

  it('senza immagine lo sfondo `image` ripiega su brace', () => {
    applyAppearance({
      appearance: { ...DEFAULT_PREFERENCES.appearance, background: 'image' },
      backgroundImage: null,
    })
    expect(root.dataset.background).toBe('brace')
  })
})

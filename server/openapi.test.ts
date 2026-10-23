// @vitest-environment node
// Il contratto in api/openapi.yaml: ogni $ref punta a una voce che esiste.
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const spec = readFileSync(new URL('../api/openapi.yaml', import.meta.url), 'utf8')

describe('api/openapi.yaml', () => {
  it('ogni $ref locale ha la sua voce in components', () => {
    const refs = new Set([...spec.matchAll(/#\/components\/(\w+)\/(\w+)/g)].map((m) => `${m[1]}/${m[2]}`))
    const missing = [...refs].filter((ref) => {
      const [section, name] = ref.split('/')
      const block = spec.split(new RegExp(`^  ${section}:$`, 'm'))[1]?.split(/^ {0,2}\S/m)[0] ?? ''
      return !new RegExp(`^    ${name}:`, 'm').test(block)
    })
    expect(missing).toEqual([])
  })
})

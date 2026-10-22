// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { hashPassword, isPasswordHash, verifyPassword } from './password.ts'

describe('password della dashboard (AUTH-002)', () => {
  it('la password giusta passa, quella sbagliata no', async () => {
    const hash = await hashPassword('una frase lunga e sicura')
    expect(isPasswordHash(hash)).toBe(true)
    expect(await verifyPassword('una frase lunga e sicura', hash)).toBe(true)
    expect(await verifyPassword('una frase lunga e sicurA', hash)).toBe(false)
  })

  it('due hash della stessa password sono diversi (sale casuale)', async () => {
    expect(await hashPassword('stessa password')).not.toBe(await hashPassword('stessa password'))
  })

  it('un hash malformato rifiuta il login senza errori', async () => {
    expect(await verifyPassword('x', 'non-un-hash')).toBe(false)
    expect(await verifyPassword('x', 'scrypt$1$1$1$$')).toBe(false)
    expect(isPasswordHash('bcrypt$abc')).toBe(false)
  })
})

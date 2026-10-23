// @vitest-environment node
import { randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'

import { createVault, documentAad, EnvelopeError, fileAad, parseKey } from './crypto.ts'

const key = randomBytes(32)

describe('busta AES-256-GCM (DOC-015)', () => {
  it('si apre con la chiave e l’AAD giusti', () => {
    const vault = createVault(key)
    const envelope = vault.sealJson({ number: 'CA00000AA' }, documentAad('a'))
    expect(vault.openJson(envelope, documentAad('a'))).toEqual({ number: 'CA00000AA' })
  })

  it('porta formato e versione della chiave, e il chiaro non compare', () => {
    const envelope = createVault(key, 3).seal(Buffer.from('CA00000AA'), 'x')
    expect([envelope[0], envelope[1]]).toEqual([1, 3])
    expect(envelope.includes(Buffer.from('CA00000AA'))).toBe(false)
  })

  it('due buste dello stesso testo sono diverse (nonce casuale)', () => {
    const vault = createVault(key)
    expect(vault.seal(Buffer.from('uguale'), 'x').equals(vault.seal(Buffer.from('uguale'), 'x'))).toBe(false)
  })

  it('fallisce con un’altra chiave, un altro record o dati manomessi', () => {
    const vault = createVault(key)
    const envelope = vault.seal(Buffer.from('segreto'), fileAad('d1', 'f1'))
    expect(() => createVault(randomBytes(32)).open(envelope, fileAad('d1', 'f1'))).toThrow(EnvelopeError)
    expect(() => vault.open(envelope, fileAad('d2', 'f1'))).toThrow(EnvelopeError)
    const tampered = Buffer.from(envelope)
    tampered[20] ^= 1
    expect(() => vault.open(tampered, fileAad('d1', 'f1'))).toThrow(EnvelopeError)
    expect(() => createVault(key, 2).open(envelope, fileAad('d1', 'f1'))).toThrow(/versione 1/)
  })

  it('la chiave deve essere di 32 byte in base64', () => {
    expect(parseKey(key.toString('base64'))?.equals(key)).toBe(true)
    expect(parseKey(undefined)).toBeNull()
    expect(parseKey(randomBytes(16).toString('base64'))).toBeNull()
    expect(parseKey('una frase qualsiasi')).toBeNull()
  })
})

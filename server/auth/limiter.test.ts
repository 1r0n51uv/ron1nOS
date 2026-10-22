// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { createLoginLimiter } from './limiter.ts'

const MIN = 60_000

describe('limite ai tentativi (AUTH-004)', () => {
  it('blocca per 15 minuti dopo 5 errori in 15 minuti', () => {
    const limiter = createLoginLimiter()
    for (let i = 0; i < 4; i++) limiter.fail('1.2.3.4', i * MIN)
    expect(limiter.blockedFor('1.2.3.4', 4 * MIN)).toBe(0)
    limiter.fail('1.2.3.4', 4 * MIN)
    expect(limiter.blockedFor('1.2.3.4', 5 * MIN)).toBe(14 * MIN)
    expect(limiter.blockedFor('1.2.3.4', 19 * MIN)).toBe(0)
  })

  it('gli errori più vecchi di 15 minuti non contano', () => {
    const limiter = createLoginLimiter()
    for (let i = 0; i < 4; i++) limiter.fail('1.2.3.4', 0)
    limiter.fail('1.2.3.4', 16 * MIN)
    expect(limiter.blockedFor('1.2.3.4', 16 * MIN)).toBe(0)
  })

  it('un indirizzo bloccato non blocca gli altri; un login riuscito azzera', () => {
    const limiter = createLoginLimiter()
    for (let i = 0; i < 5; i++) limiter.fail('1.1.1.1', 0)
    expect(limiter.blockedFor('2.2.2.2', 0)).toBe(0)
    for (let i = 0; i < 4; i++) limiter.fail('3.3.3.3', 0)
    limiter.reset('3.3.3.3')
    limiter.fail('3.3.3.3', 0)
    expect(limiter.blockedFor('3.3.3.3', 0)).toBe(0)
  })
})

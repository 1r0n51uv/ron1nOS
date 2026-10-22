// Password della dashboard (AUTH-002): nel .env c'è solo l'hash scrypt,
// generato con `npm run auth:hash`. Formato: scrypt$N$r$p$sale$hash, sale e
// hash in base64.
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>

const N = 2 ** 15
const R = 8
const P = 1
const KEYLEN = 32

const options = (n: number, r: number, p: number) => ({ N: n, r, p, maxmem: 256 * n * r })

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const hash = await scrypt(password, salt, KEYLEN, options(N, R, P))
  return ['scrypt', N, R, P, salt.toString('base64'), hash.toString('base64')].join('$')
}

// false anche con un hash malformato: meglio un login rifiutato che un crash.
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [kind, n, r, p, salt, hash] = stored.split('$')
  if (kind !== 'scrypt' || !salt || !hash) return false
  const expected = Buffer.from(hash, 'base64')
  if (!expected.length) return false
  try {
    const actual = await scrypt(
      password,
      Buffer.from(salt, 'base64'),
      expected.length,
      options(Number(n), Number(r), Number(p)),
    )
    return timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}

export function isPasswordHash(value: string) {
  return /^scrypt\$\d+\$\d+\$\d+\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/.test(value)
}

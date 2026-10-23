// Limite ai tentativi di login (AUTH-004): dopo 5 password sbagliate in 15
// minuti dallo stesso indirizzo, il login risponde 429 per 15 minuti. In
// memoria: un riavvio azzera i contatori, e va bene così.
const WINDOW_MS = 15 * 60_000
const MAX_FAILURES = 5

type Entry = { failures: number[]; blockedUntil: number }

export type LoginLimiter = {
  // Millisecondi di blocco rimasti, 0 se si può provare.
  blockedFor(ip: string, now?: number): number
  fail(ip: string, now?: number): void
  reset(ip: string): void
}

export function createLoginLimiter({ windowMs = WINDOW_MS, maxFailures = MAX_FAILURES } = {}): LoginLimiter {
  const entries = new Map<string, Entry>()

  const prune = (now: number) => {
    for (const [ip, e] of entries) {
      if (e.blockedUntil <= now && e.failures.every((t) => now - t >= windowMs)) entries.delete(ip)
    }
  }

  return {
    blockedFor(ip, now = Date.now()) {
      return Math.max(0, (entries.get(ip)?.blockedUntil ?? 0) - now)
    },
    fail(ip, now = Date.now()) {
      prune(now)
      const e = entries.get(ip) ?? { failures: [], blockedUntil: 0 }
      e.failures = [...e.failures.filter((t) => now - t < windowMs), now]
      if (e.failures.length >= maxFailures) {
        e.blockedUntil = now + windowMs
        e.failures = []
      }
      entries.set(ip, e)
    },
    reset(ip) {
      entries.delete(ip)
    },
  }
}

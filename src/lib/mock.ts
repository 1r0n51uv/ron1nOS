// Latenza finta per le sorgenti mock, così loading e refetch si comportano
// come con le API vere.
export function mockDelay<T>(value: T, ms = 250): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(structuredClone(value)), ms))
}

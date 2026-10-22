// Client YAZIO collegato al YAZIO finto, per i test delle rotte che lo usano.
import type { Queryable } from '../db.ts'
import { createYazioClient } from '../yazio/client.ts'
import { memoryTokenStore } from '../yazio/tokens.ts'
import { createFakeYazio, FAKE_CLIENT, FAKE_USER } from './fake-yazio.ts'

export function fakeYazioDeps() {
  const fake = createFakeYazio()
  const tokens = memoryTokenStore()
  const yazio = (_: Queryable) =>
    createYazioClient({
      url: 'http://yazio.test/v20',
      clientId: FAKE_CLIENT.id,
      clientSecret: FAKE_CLIENT.secret,
      username: FAKE_USER.username,
      password: FAKE_USER.password,
      tokens,
      fetch: fake.fetch as typeof fetch,
      sleep: async () => {},
    })
  return { fake, yazio }
}

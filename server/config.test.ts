// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { loadConfig } from './config.ts'

const yazio = {
  YAZIO_USERNAME: 'mario@example.com',
  YAZIO_PASSWORD: 'segreta',
  YAZIO_CLIENT_ID: 'id',
  YAZIO_CLIENT_SECRET: 'secret',
  YAZIO_TOKEN_KEY: 'chiave',
}

describe('loadConfig', () => {
  it('senza DATABASE_URL il database è spento', () => {
    expect(loadConfig({}).databaseUrl).toBeUndefined()
    expect(loadConfig({ DATABASE_URL: 'postgres://x' }).databaseUrl).toBe('postgres://x')
  })

  it('YAZIO è attivo solo con tutte le variabili', () => {
    expect(loadConfig({}).yazio).toBeUndefined()
    expect(loadConfig({ ...yazio, YAZIO_TOKEN_KEY: '' }).yazio).toBeUndefined()
    expect(loadConfig(yazio).yazio).toEqual({
      url: 'https://yzapi.yazio.com/v15',
      clientId: 'id',
      clientSecret: 'secret',
      username: 'mario@example.com',
      password: 'segreta',
      tokenKey: 'chiave',
    })
  })

  it('YAZIO_URL cambia host e versione', () => {
    expect(loadConfig({ ...yazio, YAZIO_URL: 'http://localhost:18082/v20/' }).yazio?.url).toBe(
      'http://localhost:18082/v20',
    )
  })
})

// Configurazione del backend, tutta da variabili d'ambiente (.env dello
// stack sul server). Le credenziali di qBittorrent restano qui e non
// arrivano mai ai client.
import type { YazioConfig } from './yazio/client.ts'

export type Config = {
  port: number
  staticDir: string
  qbt: { url: string; username: string; password: string }
  // Attesa dei metadati di un magnet prima di proporre Riprova (DL-005).
  metadataWaitMs: number
  glances: { url: string }
  // Postgres del modulo Nutrizione; senza, il modulo risponde 503.
  databaseUrl?: string
  // Account YAZIO (modulo Nutrizione): attivo solo con tutte le variabili.
  yazio?: YazioConfig & { tokenKey: string }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: Number(env.PORT ?? 8080),
    staticDir: env.STATIC_DIR ?? 'dist',
    qbt: {
      url: (env.QBT_URL ?? 'http://qbittorrent:8080').replace(/\/+$/, ''),
      username: env.QBT_USERNAME ?? '',
      password: env.QBT_PASSWORD ?? '',
    },
    metadataWaitMs: Number(env.METADATA_WAIT_SECONDS ?? 60) * 1000,
    // Glances gira in rete host (infra/glances): dal container si raggiunge
    // con host.docker.internal.
    glances: {
      url: (env.GLANCES_URL ?? 'http://host.docker.internal:61208').replace(/\/+$/, ''),
    },
    databaseUrl: env.DATABASE_URL || undefined,
    yazio: yazioConfig(env),
  }
}

function yazioConfig(env: NodeJS.ProcessEnv): Config['yazio'] {
  const { YAZIO_USERNAME, YAZIO_PASSWORD, YAZIO_CLIENT_ID, YAZIO_CLIENT_SECRET, YAZIO_TOKEN_KEY } = env
  if (!YAZIO_USERNAME || !YAZIO_PASSWORD || !YAZIO_CLIENT_ID || !YAZIO_CLIENT_SECRET || !YAZIO_TOKEN_KEY) {
    return undefined
  }
  return {
    url: (env.YAZIO_URL ?? 'https://yzapi.yazio.com/v20').replace(/\/+$/, ''),
    clientId: YAZIO_CLIENT_ID,
    clientSecret: YAZIO_CLIENT_SECRET,
    username: YAZIO_USERNAME,
    password: YAZIO_PASSWORD,
    tokenKey: YAZIO_TOKEN_KEY,
  }
}
